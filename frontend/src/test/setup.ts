import "@testing-library/jest-dom";

// framer-motion uses ResizeObserver; jsdom doesn't provide it
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom does not implement DataTransfer; provide a minimal polyfill
class MockDataTransfer {
  private _files: File[] = [];
  items = {
    add: (f: File) => this._files.push(f),
  };
  get files(): FileList {
    const arr = this._files;
    return Object.assign(arr, {
      item: (i: number) => arr[i] ?? null,
      [Symbol.iterator]: arr[Symbol.iterator].bind(arr),
    }) as unknown as FileList;
  }
}
// @ts-expect-error — polyfill for jsdom
global.DataTransfer = MockDataTransfer;
