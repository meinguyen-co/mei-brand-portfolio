# Mei Nguyen — Brand, Campaigns & Commerce

Private source repository for Mei Nguyen's marketing portfolio.

## Migration status
**Source migration pending.** This repository does not yet contain the website. Do not deploy this README as a website.

The existing Sites project is `appgprj_6acd0b5a03ac819199582c03ba2a27a9`.
- Existing owner-only site: https://meinguyen.foamycurry3.chatgpt.site
- Last live version: 13 (older design)
- Saved redesign: version 14, ID `appgprj_6acd0b5a03ac819199582c03ba2a27a9~appgver_87adcb6bba248191bef8adb821daa335`
- Saved redesign source commit: `7b6f1eaef1d685f3ae37408b9632f2d4664d85db`
- Original source checkout: `/workspace/sites/mei-portfolio` (session-specific; not currently available)

## Recovery checklist
1. Open the existing Sites project and restore the **saved redesign version 14**, not live version 13.
2. Export/copy the complete project source and assets, including `dist/`, `scripts/`, source manifests, and `REDESIGN-DRAFT.md`. The saved archive contained 177 files and approximately 109 MB.
3. Validate the redesigned seven-section homepage, fifteen logos, seven projects, media, editing/backup behavior, responsiveness, and content/credit accuracy.
4. Commit the validated source to this private GitHub repository.
5. Connect Vercel to this repository and configure the correct static output directory (`dist` if the recovered source confirms it). Use preview deployments for QA; publish only after explicit approval.
6. Keep the original Sites project's owner-only permissions unchanged.

## Publishing behavior
A push to `main` can trigger automatic Vercel deployment after integration is configured. Browser-local edits on the original site are **not** automatically synced to GitHub. Do not promise instant propagation of browser-local edits without a separately implemented publishing flow.

## Design direction
White base, burgundy `#781D43`, lime `#DDF18E`, violet `#6740CA`. Hero: “Think bold. Make it matter.” Thinking: “Heart in the idea. Clarity in the plan.” Preserve authentic project results, credits, and source assets.

This README is a migration handoff, not a replacement for the saved website source.
