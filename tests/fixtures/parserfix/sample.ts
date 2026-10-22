import { readFileSync } from 'fs';

/** Options for widgets. */
export interface WidgetOptions {
  name: string;
  size?: number;
}

export type Mapper<T, R> = (value: T) => R;

/**
 * Parse a number.
 */
export function parse(input: string | number): number {
  return typeof input === 'string' ? Number(input) : input;
}

export const double = (x: number): number => x * 2;

export class Widget<T> {
  private items: T[] = [];
  constructor(private readonly options: WidgetOptions) {}

  /** Add an item. */
  add(item: T): number {
    this.items.push(item);
    return this.items.length;
  }

  map<R>(fn: Mapper<T, R>): R[] {
    return this.items.map(fn);
  }

  static fromFile(path: string): Widget<string> {
    return new Widget<string>({ name: readFileSync(path, 'utf8') });
  }

  get size(): number { return this.items.length; }
}

export abstract class Base {
  abstract run(): void;
  protected helper(): string { return 'base'; }
}

export async function load(url: string): Promise<string> {
  return url;
}

export default function main(): void {
  const w = new Widget<number>({ name: 'w' });
  w.add(1);
}
