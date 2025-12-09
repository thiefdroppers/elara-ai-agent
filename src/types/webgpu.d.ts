/**
 * WebGPU Type Declarations (minimal subset for Elara)
 */

interface GPUAdapter {
  requestDevice(): Promise<GPUDevice>;
}

interface GPUDevice {
  // Minimal interface - we only check existence
}

interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>;
}

interface Navigator {
  gpu?: GPU;
}

declare const GPU: {
  prototype: GPU;
  new(): GPU;
};
