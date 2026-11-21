export type Confidence = 'low' | 'medium' | 'high';

export interface StateField {
  name: string;
  confidence: Confidence;
}

export interface ActionMetadata {
  name: string;
  confidence: Confidence;
}

export interface Dependency {
  target: string;
  targetFile?: string;
  confidence: Confidence;
  via: 'read' | 'write' | 'subscribe';
}

export interface StoreMetadata {
  id: string;
  name: string;
  filePath: string;
  creationApi: 'create' | 'createStore' | 'createWithEqualityFn';
  stateFields: StateField[];
  actions: ActionMetadata[];
  readsFrom: Dependency[];
  writesTo: Dependency[];
  subscribesTo: Dependency[];
}

/** Describes how a local identifier was bound (import / local declaration). */
export interface ImportBinding {
  localName: string;
  importedName?: string;       // undefined for default / namespace / local
  source?: string;             // module specifier; undefined for local bindings
  isAlias: boolean;            // true when importedName !== localName
  isDefault: boolean;
  isNamespace: boolean;
  isReExport: boolean;         // re-exported from another module
}

/** Result of resolving an identifier to a known store. */
export interface StoreResolution {
  storeId: string;
  storeName: string;
  confidence: Confidence;
  via: 'direct' | 'import' | 're-export' | 'barrel';
}

export interface AnalysisOptions {
  confidenceThreshold: Confidence;
  ownership?: Record<string, { owner: string; allowedWriters?: string[] }>;
  allowedDependencies?: Record<string, string[]>;
}

/** Outcome of analyzing a single source file. */
export interface FileAnalysis {
  filePath: string;
  stores: StoreMetadata[];
  dependencies: Dependency[];
}

/** Slice metadata discovered during slice composition analysis. */
export interface SliceMetadata {
  name: string;
  filePath: string;
  stateFields: string[];
  actions: string[];
}