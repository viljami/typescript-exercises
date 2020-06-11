declare module 'stats' {
    type Comparator<T> = (a: T, b: T) => number;
    type getIndexFn<T> = (input: T[], comparator: Comparator<T>) => number;
    type getElementFn<T> = (input: T[], comparator: Comparator<T>) => T | null;

    export const getMaxIndex: getIndexFn;
    export const getMaxElement: getElementFn;
    export const getMinIndex: getIndexFn;
    export const getMinElement: getElementFn;
    export const getMedianIndex: getIndexFn;
    export const getMedianElement: getElementFn;
    export const getAverageValue: <A, B>(input: A[], getValue: (item: A) => B) => B;
}
