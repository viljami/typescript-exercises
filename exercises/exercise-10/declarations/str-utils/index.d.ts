declare module 'str-utils' {
    type strFn = (value: string) => string;

    export const strReverse: strFn;
    export const strToLower: strFn;
    export const strToUpper: strFn;
    export const strRandomize: strFn;
    export const strInvertCase: strFn;
}
