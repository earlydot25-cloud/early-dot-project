declare module 'jspdf' {
  export interface jsPDFOptions {
    orientation?: 'portrait' | 'landscape';
    unit?: 'pt' | 'px' | 'in' | 'mm' | 'cm' | 'ex' | 'em' | 'pc';
    format?: string | number[];
    compress?: boolean;
    precision?: number;
    userUnit?: number;
    encryption?: any;
    putOnlyUsedFonts?: boolean;
    floatPrecision?: number | 'smart';
  }

  export default class jsPDF {
    constructor(options?: jsPDFOptions);
    constructor(
      orientation?: 'portrait' | 'landscape' | 'p' | 'l',
      unit?: 'pt' | 'px' | 'in' | 'mm' | 'cm' | 'ex' | 'em' | 'pc',
      format?: string | number[],
      compress?: boolean
    );
    addImage(
      imageData: string,
      format: string,
      x: number,
      y: number,
      width: number,
      height: number,
      alias?: string,
      compression?: string,
      rotation?: number
    ): jsPDF;
    addPage(): jsPDF;
    save(filename: string): void;
    output(type?: string, options?: any): string | ArrayBuffer | Blob | Uint8Array;
  }
}

