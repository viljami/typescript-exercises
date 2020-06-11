const fs = require('fs').promises;

type Field<V> =
    { $eq: V } |
    { $gt: V } |
    { $lt: V } |
    { $in: V[] };


type Query<T extends {}> = {
    [K in keyof T]?: Field<T[K]>
} & {
    $and?: Query<T>[];
    $or?: Query<T>[];
    $text?: string;
};

type FindOptions<T> = {
    sort: { [K in keyof T]: 1 | -1 },
} | {
    projection: Array<keyof T>
} | {};

const isFirstLetter = (letter: string) => (s: string): boolean => letter === s[0];
const omitFirstLetter = (s: string): string => s.trim().substr(1);
function unite<T>(args: T[][]): T[] {
    return ([] as T[])
        .concat(...args)
        .reduce(
            (o: T[], u: T): T[] => o.includes(u) ? o : [...o, u],
            [] as T[]
        )
}
function intersect<T>(args: T[][]): T[] {
    return ([] as T[])
        .concat(...args)
        .reduce((o: T[], u: T, i: number, a: T[]): T[] =>
            a.filter((v: T) => u === v).length > 1 && !o.includes(u) ? [...o, u] : o
            , [] as T[]);
}
function toRow<T>(s: string): T { return JSON.parse(s) };
function pluck<T>(keys: (keyof T)[]) {
    return function(target: T): Partial<T> {
        return keys.reduce((a: Partial<T>, key: (keyof T)): Partial<T> => {
            a[key] = target[key];
            return a;
        }, {});
    }
}

const sort = function<T>(key: keyof T) {
    return function(a: Partial<T>, b:Partial<T>): number {
        return a[key] > b[key] ? 1 : -1
    }
}
export class Database<T> {
    protected filename: string;
    protected fullTextSearchFieldNames: (keyof T)[];

    constructor(filename: string, fullTextSearchFieldNames: (keyof T)[]) {
        this.filename = filename;
        this.fullTextSearchFieldNames = fullTextSearchFieldNames;
    }

    async find(query: Query<T>, options: FindOptions<T> = {}): Promise<Partial<T>[]> {
        const rows = await this.getRows();
        let results: Partial<T>[] = Object.keys(query).length ? this.getMatchingRows(query, rows) : rows;

        if ('sort' in options) {
            const keys = Object.keys(options.sort) as (keyof T)[];
            results = results.sort(sort<T>(keys[0]))
        }

        if ('projection' in options) {
            const keys = Object.keys(options.projection) as (keyof T)[];
            results = results.map(pluck<Partial<T>>(keys));
        }

        return results;
    }

    async getRows(): Promise<T[]> {
        try {
            return (await fs.readFile(this.filename, { encoding: 'utf8' }))
                .split('\n')
                .filter(isFirstLetter('E'))
                .map(omitFirstLetter)
                .map((s: string) => toRow<T>(s));
        } catch (e) {
            throw e;
        }
    }

    getMatchingRows(query: Query<T>, rows: T[]): T[] {
        return unite<T>(
            (Object.keys(query) as (keyof Query<T>)[])
                    .map((qKey: (keyof Query<T>)): T[] => {
                        if (qKey === '$and') {
                            return intersect<T>(
                                query
                                    .$and!
                                    .map((q: Query<T>): T[] => this.getMatchingRows(q, rows))
                            );
                        } else if (qKey === '$or') {
                            return unite<T>(
                                query
                                    .$or!
                                    .map((q: Query<T>): T[] => this.getMatchingRows(q, rows))
                            );
                        } else if (qKey === '$text') {
                            return rows.reduce((o: T[], row: T) =>
                                this.fullTextSearchFieldNames.some((key: (keyof T)): boolean =>
                                    query.$text!
                                        .trim()
                                        .toLowerCase()
                                        .split(' ')
                                        .every((s: string) => String(row[key]).toLowerCase().split(' ').includes(s))
                                ) ? [...o, row] : o
                                , []);
                        } else {
                            const operation: Field<T> = query[qKey] as keyof Field<unknown>;
                            const operationKey = (Object.keys(operation) as Array<keyof Field<T>>)[0];
                            const operationValue = query[qKey][operationKey];

                            if ('$eq' in operation) return rows.filter((a: T) => a[qKey] === operationValue)
                            if ('$gt' in operation) return rows.filter((a: T) => a[qKey] > operationValue)
                            if ('$lt' in operation) return rows.filter((a: T) => a[qKey] < operationValue)
                            if ('$in' in operation) {
                                return rows.filter((a: T) => (operationValue as Array<string | number>)
                                    .some((value) => String(a[qKey]) === String(value))
                                );
                            }
                        }

                        return [];
                    }
                    )
            );
    }
}
