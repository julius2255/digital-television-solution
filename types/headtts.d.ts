declare module "@met4citizen/headtts" {
  export interface HeadTTSOptions {
    endpoints?: string[];
    languages?: string[];
    voices?: string[];
    workerModule?: string;
    dictionaryURL?: string;
  }

  export interface HeadTTSSetupOptions {
    voice: string;
    language: string;
    speed?: number;
    audioEncoding?: string;
  }

  export class HeadTTS {
    constructor(options?: HeadTTSOptions);
    connect(): Promise<void>;
    setup(options: HeadTTSSetupOptions): void;
    synthesize(options: {input: string}): Promise<Array<{type: string; data?: ArrayBuffer | Uint8Array}>>;
  }
}
