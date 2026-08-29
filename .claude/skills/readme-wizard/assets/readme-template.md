<!--
Base structure, not a form to fill in. Drop any section the scan cannot support.
Blocks marked "requires a GitHub remote" resolve through github.com/{{OWNER}}/{{REPO}};
if scan-project.ts reports empty owner/repo, delete them rather than leaving them broken.
-->

<div align="center">

# {{PROJECT_NAME}}

{{TAGLINE}}

<!-- Only badges for things the scan actually found. No scan data, no badge. -->
{{STATUS_BADGES}}

</div>

## What is this?

{{DESCRIPTION}}

<!-- For a repo with no runnable code yet, replace Quick Start with a document map. -->
## Quick Start

{{INSTALL_AND_RUN_COMMANDS}}

## Project Structure

```
{{FILE_TREE}}
```

## Documentation

| Resource | Description |
|----------|-------------|
{{DOC_ROWS}}

## Contributing

{{CONTRIBUTING_TEXT}}

<!-- Requires a GitHub remote. Delete if the scan found no owner/repo. -->
<a href="https://github.com/{{OWNER}}/{{REPO}}/graphs/contributors">
  <img src="https://contrib.rocks/image?repo={{OWNER}}/{{REPO}}" />
</a>

<!-- Include ONLY if the scan found social links. Remove entirely if none exist. -->
## Connect

{{SOCIAL_BADGES}}

<!-- Include ONLY if a LICENSE file exists. -->
## License

{{LICENSE_TEXT}}

---

<!-- Requires a GitHub remote. Delete if the scan found no owner/repo. -->
<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos={{OWNER}}/{{REPO}}&type=Date)](https://star-history.com/#{{OWNER}}/{{REPO}}&Date)

</div>
