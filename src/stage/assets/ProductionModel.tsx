// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
import React, { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { Clone } from '@react-three/drei';
import type { GroupProps } from '@react-three/fiber';
import type { ProductionAsset } from './productionAssetManifest';

type Props = GroupProps & {
  asset: ProductionAsset;
  /** Existing R3F blockout can be supplied while the GLB is missing or invalid. */
  fallback?: ReactNode;
  onAssetError?: (assetId: string, error: Error) => void;
};

class AssetErrorBoundary extends Component<{
  assetId: string; fallback?: ReactNode; onAssetError?: (assetId: string, error: Error) => void;
  children: ReactNode;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onAssetError?.(this.props.assetId, error);
  }
  render() { return this.state.failed ? this.props.fallback ?? null : this.props.children; }
}

function LoadedModel({ asset, ...groupProps }: Props) {
  const gltf = useGLTF(asset.path);
  return <group {...groupProps}><Clone object={gltf.scene} /></group>;
}

/**
 * Place inside the existing game Canvas. The parent owns scene-level Suspense,
 * loading UI and quality policy. Error fallback is local to this one asset.
 */
export function ProductionModel({ asset, fallback, onAssetError, ...groupProps }: Props) {
  if (asset.fallback === 'hide' && fallback === undefined) {
    return <AssetErrorBoundary assetId={asset.id} onAssetError={onAssetError}>
      <Suspense fallback={null}><LoadedModel asset={asset} {...groupProps} /></Suspense>
    </AssetErrorBoundary>;
  }
  return <AssetErrorBoundary assetId={asset.id} fallback={fallback} onAssetError={onAssetError}>
    <Suspense fallback={fallback ?? null}><LoadedModel asset={asset} {...groupProps} /></Suspense>
  </AssetErrorBoundary>;
}
