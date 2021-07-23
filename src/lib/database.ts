/**
 * Database access layers.
 */

export type Insertable = string | number;

export interface Database {
    insert(args: Insertable[]): Promise<boolean>;
    update(key: string, to: Insertable, where?: string, whereArgs?: Insertable[]): Promise<boolean>;
    selectOne<T>(keys: string[], where?: string, whereArgs?: Insertable[]): Promise<T>;
    selectAll<T>(keys: string[], where?: string, whereArgs?: Insertable[]): Promise<T[]>;
    deleteOne(where: string, whereArgs: Insertable[]): Promise<boolean>;
    deleteAll(where: string, whereArgs: Insertable[]): Promise<boolean>;
    count(where: string): Promise<number>;
}

// some options 
export class SQLDatabase implements Database {
    tableName: string;
    database: import('better-sqlite3').Database;
    keys: string[];
    statementCache = new Map<string, import('better-sqlite3').Statement>();
    constructor(options: {
        tableName: string, 
        file: string,
        keys: string[],
    }) {
        this.tableName = options.tableName;
        this.database = new (require('better-sqlite3'))(options.file);
        this.keys = options.keys;
    }
    prepare(source: string) {
        let statement = this.statementCache.get(source);
        if (!statement) {
            statement = this.database.prepare(source);
            this.statementCache.set(source, statement);
        }
        return statement;
    }
    insert(args: Insertable[], isReplace = false) {
        const type = isReplace ? 'REPLACE' : 'INSERT';
        const statement = this.prepare(`${type} INTO ${this.tableName} (${this.keys.join(',')}) VALUES (${this.keys.map(() => '?').join(',')})`);
        const result = statement.run(args);
        return Promise.resolve(!!result.changes);
    }
    update(key: string, to: Insertable, where?: string) {
        const statement = this.prepare(
            `UPDATE ${this.tableName} SET ${key} = ?${where ? ` WHERE ${where}` : ""}`
        );
        const result = statement.run(to);
        return Promise.resolve(!!result.changes);
    }
    selectAll<T>(keys: string[] | string, where?: string, whereArgs?: Insertable[]) {
        const keyList = Array.isArray(keys) ? keys.join(', ') : keys;
        const statement = this.prepare(`SELECT ${keyList} FROM ${this.tableName}${where ? ` WHERE ${where}` : ""}`);
        return Promise.resolve(statement.all(whereArgs || [])) as Promise<T[]>;
    }
    selectOne<T>(keys: string[] | string, where?: string, whereArgs?: Insertable[]) {
        const keyList = Array.isArray(keys) ? keys.join(', ') : keys;
        const statement = this.prepare(`SELECT ${keyList} FROM ${this.tableName}${where ? ` WHERE ${where}` : ""} LIMIT 1`);
        return Promise.resolve(statement.get(whereArgs || [])) as Promise<T>;
    }
    count(where: string) {
        const statement = this.prepare(`SELECT COUNT(*) FROM ${this.tableName} WHERE ${where}`);
        return Promise.resolve(statement.get()['count(*)'] as number);
    }
    deleteOne(where: string, whereArgs: Insertable[]) {
        const statement = this.prepare(`DELETE FROM ${this.tableName} WHERE ${where} LIMIT 1`);
        const result = statement.run(whereArgs);
        return Promise.resolve(!!result.changes);
    }
    deleteAll(where: string, whereArgs: Insertable[]) {
        const statement = this.prepare(`DELETE FROM ${this.tableName} WHERE ${where} LIMIT 1`);
        const result = statement.run(whereArgs);
        return Promise.resolve(!!result.changes);
    }
}