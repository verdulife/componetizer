import {
  type ExtensionContext,
  type TextEditor,
  commands,
  window,
  workspace,
  Position,
  Selection,
} from "vscode";
import { access, mkdir, constants, writeFile } from "node:fs/promises";
import { join, extname, basename, relative, dirname } from "node:path";

const { registerCommand } = commands;
const {
  activeTextEditor,
  showErrorMessage,
  showInputBox,
  showInformationMessage,
  showWarningMessage,
} = window;

function getWorkspaceRootPath(): string | undefined {
  if (activeTextEditor) {
    const workspaceFolder = workspace.getWorkspaceFolder(
      activeTextEditor.document.uri
    );
    if (workspaceFolder) {
      return workspaceFolder.uri.fsPath;
    }
  }
  return undefined;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

function generateImportStatement(
  filePath: string,
  componentName: string,
  currentDocumentPath: string
): string {
  /* const tsConfigPath = join(rootPath, "tsconfig.json");
  const tsConfig = require(tsConfigPath);
  const { compilerOptions } = tsConfig;

  if (compilerOptions.paths) {
    if (compilerOptions.paths["components/*"]) {
      const aliasValue = compilerOptions.paths["components/*"][0];
      const relativePath = relative(dirname(tsConfigPath), filePath);
      const importPath = join(aliasValue, relativePath.replace(".html", ""));
      return `import ${componentName} from '${importPath}';\n`;
    }

    if (compilerOptions.paths["src/*"]) {
      const aliasValue = compilerOptions.paths["src/*"][0];
      const relativePath = relative(dirname(tsConfigPath), filePath);
      const importPath = join(aliasValue, relativePath.replace(".html", ""));
      return `import ${componentName} from '${importPath}';\n`;
    }
  } */

  return `import ${componentName} from '${relative(
    dirname(currentDocumentPath),
    filePath
  ).replace(/\\/g, "/")}';\n`;
}

function checkExistingImports(editor: TextEditor): {
  hasImports: boolean;
  lastImportIndex: number;
} {
  let hasImports = false;
  let lastImportIndex = -1;

  for (let i = 0; i < editor.document.lineCount; i++) {
    const lineText = editor.document.lineAt(i).text.trim();
    if (lineText.startsWith("import ")) {
      hasImports = true;
      lastImportIndex = i;
    }
  }

  return { hasImports, lastImportIndex };
}

export function activate(context: ExtensionContext) {
  let disposable = registerCommand(
    "componetizer.generateComponent",
    async () => {
      if (!activeTextEditor) {
        showErrorMessage("No code fragment selected.");
        return;
      }

      const selectedText = activeTextEditor.document.getText(
        activeTextEditor.selection
      );

      if (!selectedText) {
        showErrorMessage("No code fragment selected.");
        return;
      }

      const fileName = await showInputBox({
        prompt: "Enter the component file name",
        placeHolder: "Ex. MyComponent.jsx",
      });

      if (!fileName) return;

      const rootPath = getWorkspaceRootPath();

      if (rootPath) {
        let componentsFolder: string;

        if (
          await access(
            join(rootPath, "src", "lib", "components"),
            constants.F_OK
          )
            .then(() => true)
            .catch(() => false)
        ) {
          componentsFolder = join(rootPath, "src", "lib", "components");
        } else if (
          await access(join(rootPath, "src", "components"), constants.F_OK)
            .then(() => true)
            .catch(() => false)
        ) {
          componentsFolder = join(rootPath, "src", "components");
        } else {
          showErrorMessage(
            'Could not find the "components" folder in "src/" or "src/lib/".'
          );
          return;
        }

        try {
          await mkdir(componentsFolder, { recursive: true });
        } catch (error) {
          showErrorMessage('Error creating the "components" folder');
          return;
        }

        const fileExtension = extname(fileName);
        const componentName = basename(fileName, fileExtension);
        const filePath = join(componentsFolder, fileName);

        if (await fileExists(filePath)) {
          const overwrite = await showWarningMessage(
            `The file "${fileName}" already exists. Do you want to replace it?`,
            "Yes",
            "No"
          );

          if (overwrite !== "Yes") return;
        }

        try {
          await writeFile(filePath, selectedText);
          showInformationMessage(
            `Component "${componentName}" created successfully.`
          );

          activeTextEditor.edit((editBuilder) => {
            /* const { hasImports, lastImportIndex } =
              checkExistingImports(activeTextEditor); */
            /* const importStatement = generateImportStatement(
                filePath,
              componentName,
              currentDocumentPath
            );

            if (hasImports) {
              const lastImportPosition =
                activeTextEditor.document.lineAt(lastImportIndex).range.end;
                editBuilder.insert(lastImportPosition, `\n${importStatement}`);
              } else {
                editBuilder.insert(new Position(1, 0), importStatement);
              } */

            /* const currentDocumentPath = activeTextEditor.document.uri.fsPath; */

            const componentSnippet = `<${componentName}></${componentName}>`;
            editBuilder.replace(activeTextEditor.selection, componentSnippet);

            setTimeout(() => {
              // command to run action: add all the imports
              commands.executeCommand("editor.action.autoImport");
            });
          });

          // await commands.executeCommand("editor.action.formatDocument");
          // Make this code below format the new component without open it or focus it.

          /* TODO: 
          - move and autoimport nested componets
          - fix aliases
          - refactor/modularize
          - detect and generate component props
          - try to use vscode ts intelisense to generate props, imports, etc, properly.
          */
        } catch (error) {
          showErrorMessage("Error writing the file");
          return;
        }
      } else showErrorMessage("Could not obtain the project's path.");
    }
  );

  context.subscriptions.push(disposable);
}
