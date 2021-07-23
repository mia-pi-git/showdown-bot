/**
 * Makes storing users, etc easier.
 */

export class TableCache<T, U = T | undefined> {
    private readonly table = new Map<string, T>();
    readonly fallback?: (input: string) => T;
    constructor(fallback?: (input: string) => T) {
        this.fallback = fallback;
    }
    set(k: string, item: T): this {
        this.table.set(k, item);
        return this;
    }
    get(item: string): U {
        let result = this.table.get(item);
        if (this.fallback) {
            result = this.fallback(item);
            this.table.set(item, result);
        }
        return result as any as U;
    }
    get size() {
        return this.table.size;
    }
    
    [Symbol.iterator]() { return this.table[Symbol.iterator](); }
    entries() { return this.table.entries() }
    values() { return this.table.values() }

    seek(checker: (val: T, key: string, map: this) => boolean) {
        const table = new TableCache<T, U>(this.fallback);
        for (const [k, v] of this) {
            if (checker.call(this, v, k, this)) {
                table.set(k, v);
            }
        }
        return table;
    }
}