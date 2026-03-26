# CI/CD Integration

Automate InkLoom documentation deployments from your CI/CD pipeline. All examples use the `@inkloom/cli` package and require a Pro plan or above.

## GitHub Actions — Basic

Deploy documentation on every push to `main`:

```yaml
# .github/workflows/deploy-docs.yml
name: Deploy Documentation
on:
  push:
    branches: [main]
concurrency:
  group: deploy-docs
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g @inkloom/cli
      - name: Deploy to production
        run: inkloom deploy ${{ secrets.INKLOOM_PROJECT_ID }} --production --wait
        env:
          INKLOOM_API_KEY: ${{ secrets.INKLOOM_API_KEY }}
```

## GitHub Actions — Path Filtered

Only deploy when documentation files change — replace the `on` block in the basic workflow:

```yaml
on:
  push:
    branches: [main]
    paths: ['docs/**', 'openapi.yaml']
```

## GitHub Actions — Preview Deploys

Deploy a preview on PRs and comment the URL. Trigger on `pull_request`, omit `--production`, capture the output URL.

```yaml
# .github/workflows/preview-docs.yml
name: Preview Documentation
on:
  pull_request:
    paths: ['docs/**']
concurrency:
  group: preview-docs-${{ github.event.pull_request.number }}
  cancel-in-progress: true
jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g @inkloom/cli
      - name: Deploy preview
        id: deploy
        run: |
          result=$(inkloom deploy ${{ secrets.INKLOOM_PROJECT_ID }} --wait)
          echo "url=$(echo $result | jq -r '.url')" >> $GITHUB_OUTPUT
        env:
          INKLOOM_API_KEY: ${{ secrets.INKLOOM_API_KEY }}
      - name: Comment preview URL
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `📚 Documentation preview: ${{ steps.deploy.outputs.url }}`
            })
```

## InkLoom Docs Action

Official action — syncs MDX files and deploys in one step. Set `target: production` for the live site (default: `preview`).

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: inkloom-io/docs-action@v1
        with:
          project-id: ${{ secrets.INKLOOM_PROJECT_ID }}
          api-key: ${{ secrets.INKLOOM_API_KEY }}
          target: production
```

## GitLab CI

```yaml
# .gitlab-ci.yml
deploy-docs:
  image: node:20
  stage: deploy
  script:
    - npm install -g @inkloom/cli
    - inkloom deploy $INKLOOM_PROJECT_ID --production --wait
  only:
    - main
  variables:
    INKLOOM_API_KEY: $INKLOOM_API_KEY
    INKLOOM_PROJECT_ID: $INKLOOM_PROJECT_ID
```

## CircleCI

```yaml
# .circleci/config.yml
version: 2.1
jobs:
  deploy-docs:
    docker:
      - image: node:20
    steps:
      - checkout
      - run: npm install -g @inkloom/cli
      - run: inkloom deploy $INKLOOM_PROJECT_ID --production --wait
workflows:
  deploy:
    jobs:
      - deploy-docs:
          filters:
            branches:
              only: main
```

## Required Secrets

| Secret | Description | Where to find |
|--------|-------------|---------------|
| `INKLOOM_API_KEY` | API key for authentication | Dashboard → Settings → API Keys |
| `INKLOOM_PROJECT_ID` | Target project identifier | Project Settings, or `inkloom projects list` |

Store in your CI provider's secret management. Never hardcode tokens. Token format: `ik_live_user_...` — org or project-scoped keys recommended.

## Concurrency

Use `cancel-in-progress` to avoid redundant deployments. For production, group by a fixed name (`deploy-docs`). For previews, scope per PR (`preview-docs-${{ github.event.pull_request.number }}`). Both patterns are shown in the workflows above. GitLab CI: use `interruptible: true` + `resource_group`. CircleCI: enable workflow-level auto-cancel in project settings.
