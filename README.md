# Berrios Tree Service

Static mirror of [berriostreeservice.com](https://www.berriostreeservice.com), scraped from Webflow.

Refresh the mirror with `node scripts/scrape.mjs`.

Serve it locally with `node scripts/serve.mjs` (`http://127.0.0.1:4173`). Clean URLs map to each page's `index.html`. Unknown paths return `404.html`.

## Tracking

GTM is in use, not GA4.

Every page loads `https://www.googletagmanager.com/gtag/js?id=G-FM8452YRQM`. Leave that snippet in place. Do not add a separate GA4 tag.

## To do

- [x] Scrape the Webflow site into this repo
- [x] Serve the mirror locally and check pages, nav, tabs, lightbox, and images
- [ ] Finish the contact form: upload `assets/js/estimate-config.js`, then confirm a submission arrives at `berriostreesvc@gmail.com` after that address is verified in SES or production access is approved.

## Estimate emails

The contact form posts to a Lambda in this AWS account. The function sends through SES from `Berrios Tree Service <estimates@berriostreeservice.com>` to `berriostreesvc@gmail.com`. The visitor's address is the reply-to.

`berriostreeservice.com` is verified in SES. Production access is required before SES will deliver to the Gmail inbox. Create the function in the same region as that verified domain. Give it permission to send email, and set `TO_EMAIL` only if the inbox should change.

Then set `endpoint` in [assets/js/estimate-config.js](assets/js/estimate-config.js) to the Lambda function URL and upload that file to S3.
- [ ] Host the static files on S3 + CloudFront
- [ ] Point the domain at CloudFront, then leave Webflow
- [ ] Keep GTM. Do not add a direct GA4 tag


## Local Server

Start in repo root:
node scripts/serve.mjs

