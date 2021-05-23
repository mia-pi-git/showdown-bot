import sqlite from 'better-sqlite3';
import fs from 'fs';

// todo run async in child worker
export class Database {
    private readonly driver: sqlite.Database;
    statementCache = new Map<string, sqlite.Statement>();
    filename: string;
    constructor(file: string, sourceFiles?: string[]) {
        this.driver = new sqlite(file);
        this.filename = file;
        if (sourceFiles) {
            for (const file of sourceFiles) {
                this.load(file);
            }
        }
    }
    exec(sql: string) {
        return this.driver.exec(sql);
    }

    get(sql: string, ...args: any[]) {
        return this.prepare(sql).get(args);
    }

    all(sql: string, ...args: any[]) {
        return this.prepare(sql).all(args);
    }

    run(sql: string, ...args: any[]) {
        return this.prepare(sql).run(args);
    }

    prepare(sql: string) {
        let statement = this.statementCache.get(sql);
        if (!statement) {
            statement = this.driver.prepare(sql);
            this.statementCache.set(sql, statement);
        }
        return statement;
    }

    load(path: string | string[]) {
        if (Array.isArray(path)) {
            for (const p of path) {
               this.load(p);
            }
            return;
        }
        const data = fs.readFileSync(`${__dirname}/../../${path}`, 'utf-8');
        this.exec(data);
    }
}

export const SQL = (
    filename: string, sourceFiles: string[] = []
) => new Database(filename, sourceFiles);