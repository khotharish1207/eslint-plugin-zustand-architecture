import type { StoreMetadata, Dependency, Confidence } from '../types';

/**
 * Registry of discovered Zustand stores.
 *
 * Stores are keyed by a stable id (normally `${filePath}#${name}`). The registry
 * is the single source of truth shared by every rule and the dependency graph.
 */
export class StoreRegistry {
  private stores = new Map<string, StoreMetadata>();
  private byName = new Map<string, string[]>(); // storeName -> storeIds

  /** Register a store. Returns the store id. */
  register(store: StoreMetadata): string {
    this.stores.set(store.id, store);
    const names = this.byName.get(store.name) ?? [];
    if (!names.includes(store.id)) {
      names.push(store.id);
      this.byName.set(store.name, names);
    }
    return store.id;
  }

  /** Look up a store by id. */
  get(id: string): StoreMetadata | undefined {
    return this.stores.get(id);
  }

  /** Look up stores by name (may return multiple when same name in different files). */
  getByName(name: string): StoreMetadata[] {
    const ids = this.byName.get(name) ?? [];
    return ids.map((id) => this.stores.get(id)!).filter(Boolean);
  }

  /** All registered stores. */
  all(): StoreMetadata[] {
    return Array.from(this.stores.values());
  }

  /** Check whether a store id is registered. */
  has(id: string): boolean {
    return this.stores.has(id);
  }

  /** Count of registered stores. */
  size(): number {
    return this.stores.size;
  }

  /** Add a dependency edge (read/write/subscribe) to a store's metadata. */
  addDependency(
    storeId: string,
    dependency: Dependency,
  ): boolean {
    const store = this.stores.get(storeId);
    if (!store) {
      return false;
    }
    const target = dependency.target;
    const via = dependency.via;
    const list =
      via === 'read'
        ? store.readsFrom
        : via === 'write'
          ? store.writesTo
          : store.subscribesTo;
    const already = list.some(
      (d) => d.target === target && d.via === via,
    );
    if (!already) {
      list.push(dependency);
    }
    return true;
  }

  /** Build a confidence-filtered snapshot of all stores. */
  snapshot(confidenceThreshold: Confidence): StoreMetadata[] {
    const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
    const min = rank[confidenceThreshold];
    return this.all().filter((store) => {
      const allDeps = [...store.readsFrom, ...store.writesTo, ...store.subscribesTo];
      return allDeps.every((d) => rank[d.confidence] >= min);
    });
  }
}