/**
 * Type declarations for xxhashjs
 */

declare module 'xxhashjs' {
  interface HashObject {
    toString(radix?: number): string;
    toNumber(): number;
  }

  interface Hasher {
    update(data: string | Uint8Array | ArrayBuffer): Hasher;
    digest(): HashObject;
  }

  export function h32(data: string | Uint8Array, seed?: number): HashObject;
  export function h64(data: string | Uint8Array, seed?: number): HashObject;

  export function h32(): Hasher;
  export function h64(): Hasher;

  const XXH: {
    h32: typeof h32;
    h64: typeof h64;
  };

  export default XXH;
}
