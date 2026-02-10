# Docker Build Optimization Guide

## 🚀 Performance Improvements

This guide documents the optimizations made to reduce Docker build times in the CI/CD pipeline.

## 📊 Current Performance (Before Optimization)

- **Lint and Type Check**: ~1m 22s
- **Publish app Image**: ~7m 19s
- **Publish docs Image**: ~7m 14s
- **Publish web-site Image**: ~8m 19s
- **Total**: ~24 minutes for all Docker builds

## 🎯 Optimization Strategy

### Problem Analysis

The original Dockerfile had several inefficiencies:

1. **Large Build Context**: Copied entire `apps/` and `packages/` directories including all source files
2. **Install All Dependencies**: `npm ci` installed dependencies for ALL apps, even when building just one
3. **Poor Layer Caching**: Changes to any file triggered rebuilding everything
4. **No Pruning**: Built the entire monorepo instead of just what's needed

### Solution: Turbo Prune + Better Caching

The optimized Dockerfile uses Turbo's `prune` command to:
- Extract only the files needed for the target app
- Install only required dependencies
- Enable better Docker layer caching
- Reduce build context size

## 📈 Expected Improvements

With the optimized Dockerfile, you should see:

- **30-50% faster builds** on cache hits
- **20-30% smaller images** due to fewer dependencies
- **60-70% smaller build context** sent to Docker daemon
- **Better parallelization** as each app is truly independent

## 🔄 Migration Steps

### Step 1: Test the Optimized Dockerfile Locally

```bash
# Test building one app with the new Dockerfile
docker build -f docker/nextjs.monorepo.optimized.Dockerfile \
  --build-arg APP_NAME=app \
  -t miot-app:test .

# Verify the image works
docker run -p 3000:3000 miot-app:test
```

### Step 2: Update CI Workflow

Edit `.github/workflows/ci.yaml` and change line 203:

```yaml
# Before
file: docker/nextjs.monorepo.Dockerfile

# After
file: docker/nextjs.monorepo.optimized.Dockerfile
```

### Step 3: Monitor First Build

The first build after the change will be slower (no cache), but subsequent builds should be significantly faster.

## 🔍 Additional Optimizations

### 1. Reduce Build Matrix Redundancy

Currently, all three apps build in parallel, which is good. However, you can add:

```yaml
# In ci.yaml, add concurrency control per app
concurrency:
  group: build-${{ matrix.app }}-${{ github.ref }}
  cancel-in-progress: true
```

### 2. Skip Unchanged Apps (Advanced)

For PRs, you can skip building apps that haven't changed:

```yaml
- name: Check for changes
  id: changes
  uses: dorny/paths-filter@v2
  with:
    filters: |
      app:
        - 'apps/app/**'
        - 'packages/**'
      docs:
        - 'apps/docs/**'
      web-site:
        - 'apps/web-site/**'

# Then use: if: steps.changes.outputs[matrix.app] == 'true'
```

### 3. Use Inline Cache (Alternative to GHA Cache)

If GHA cache isn't performing well, try inline cache:

```yaml
cache-from: type=registry,ref=${{ env.GHCR_REGISTRY }}/${{ env.IMAGE_OWNER }}/${{ matrix.image-name }}:buildcache
cache-to: type=registry,ref=${{ env.GHCR_REGISTRY }}/${{ env.IMAGE_OWNER }}/${{ matrix.image-name }}:buildcache,mode=max
```

## 📝 Key Differences

### Original Dockerfile
```dockerfile
# Copies everything
COPY apps/ ./apps/
COPY packages/ ./packages/

# Installs all dependencies
RUN npm ci --legacy-peer-deps
```

### Optimized Dockerfile
```dockerfile
# Prunes to only what's needed
RUN turbo prune @modulariot/${APP_NAME} --docker

# Only copies pruned subset
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/full/ ./

# Installs only required dependencies
RUN npm ci --legacy-peer-deps
```

## 🐛 Troubleshooting

### Issue: "turbo: command not found"

**Solution**: Ensure turbo is installed in the pruner stage:
```dockerfile
RUN npm install -g turbo
```

### Issue: Build fails with missing dependencies

**Solution**: Verify your workspace dependencies in package.json are correctly specified.

### Issue: Larger images than before

**Solution**: Check that `.dockerignore` is properly excluding development files.

## 📚 References

- [Turbo Prune Documentation](https://turbo.build/repo/docs/reference/command-line-reference/prune)
- [Docker Build Cache](https://docs.docker.com/build/cache/)
- [GitHub Actions Cache](https://docs.docker.com/build/ci/github-actions/cache/)

## ✅ Checklist

- [ ] Test optimized Dockerfile locally
- [ ] Update CI workflow to use optimized Dockerfile
- [ ] Verify first CI build completes successfully
- [ ] Monitor build times for improvements
- [ ] Consider additional optimizations (skip unchanged apps, etc.)
