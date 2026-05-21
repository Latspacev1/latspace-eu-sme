declare module "latex.js" {
  export interface LaTeXOptions {
    hyphenate?: boolean;
    [key: string]: any;
  }

  export class LaTeX {
    constructor(options?: LaTeXOptions);
    parseAndGenerateHTMLAsync(latex: string): Promise<string>;
    parse(latex: string): any;
    generateHTML(ast: any): string;
  }

  export { LaTeX as default };
}
