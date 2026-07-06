# Vector DB Prep Plan

This app should not own vector database infrastructure. Its job is to generate deterministic, versioned vectors and metadata that Media Manager can index in a vector backend later.

## Target Boundary

- `tone-embedding` emits `combo-analysis/v1` rows with `nearestNeighborVector` and `vectorLayout`.
- Media Manager decides where vectors are stored and how they are filtered for access control, visibility, ownership, tags, and lifecycle.
- The vector database handles approximate/exact nearest-neighbor search.
- App code submits query vectors and interprets ranked results.

## Future Output Additions

- Add explicit `vectorSchemaVersion`, for example `combo-neighbor-vector/v1`.
- Add explicit `metric`, probably `cosine`.
- Keep `vectorLayout` stable and versioned so old vectors remain interpretable.
- Include filter metadata near the vector export path:
  - `comboId`
  - `audioAssetId`
  - `videoAssetId`
  - visibility/tenant/owner fields from Media Manager, if exported there
  - model/schema versions
  - created timestamp
- Decide whether vectors are stored normalized or raw, based on the selected backend.

## Likely Flow

```text
asset-analysis/v1 audio row + asset-analysis/v1 video row
        ↓
combo-analysis/v1
        ↓
nearestNeighborVector + vectorLayout
        ↓
Media Manager vector index write
        ↓
query combo/user preference vector generated with same layout
        ↓
vector DB nearest-neighbor search
        ↓
Media Manager applies filters/business rules and returns combos
```

## Backend-Agnostic Work To Do Later

- Add a `vector export` command that emits backend-neutral JSONL records.
- Add validation that every exported vector matches its declared layout length.
- Add fixture tests for vector schema stability.
- Add a migration note for changing `COMBO_VECTOR_BLOCKS` weights or dimensions.
- Add local comparison tests to verify vector DB results match `neighbors query` on small fixtures.

## Non-Goals For Now

- Do not choose a vector database in this app.
- Do not add provider-specific clients here yet.
- Do not make local `neighbors query` the production lookup path.
- Do not treat nearest-neighbor score as combo quality or user preference without user-trained labels.
