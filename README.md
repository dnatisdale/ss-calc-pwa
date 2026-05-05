# SS Calc PWA

A simple Progressive Web App for planning Social Security retirement cash flow, earnings-test withholding, spouse/child family benefits, VA disability, and household income.

## What this app is for

This app is designed to help families ask better questions before filing for Social Security.

It estimates:

- earned work income
- Social Security retirement payments
- possible spouse child-in-care benefit
- possible child/dependent benefit
- VA disability as household income
- possible Social Security retirement earnings-test withholding
- estimated yearly and monthly household cash flow

It is not an official SSA calculator and should not be used as legal, tax, or financial advice.

## Important family wording

The app includes warm wording so a spouse who is doing unpaid work does not feel invisible. Homemaking, caregiving, ministry, volunteering, art, writing, and family support may not appear as taxable income, but they are real contributions.

## Test locally

Open PowerShell in the project folder and run:

```powershell
python -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

## Put it on GitHub

```powershell
git init
git add .
git commit -m "Create SS Calc PWA"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/ss-calc-pwa.git
git push -u origin main
```

Then in GitHub:

**Settings → Pages → Deploy from a branch → main → /root → Save**

## Sources to verify rules

- SSA earnings test: https://www.ssa.gov/benefits/retirement/planner/whileworking.html
- SSA 2026 exempt amounts: https://www.ssa.gov/oact/cola/rtea.html
- SSA spouse benefit eligibility: https://www.ssa.gov/faqs/en/questions/KA-02005.html
- SSA spouse benefit explanation: https://www.ssa.gov/oact/quickcalc/spouse.html
- SSA child benefit eligibility: https://www.ssa.gov/faqs/en/questions/KA-02053.html
- SSA child benefits publication: https://www.ssa.gov/pubs/EN-05-10085.pdf

## Smartphone and sharing

This version improves small-screen use for smartphones and adds a **Share App** button. On phones it opens the normal share sheet. On computers it copies the app link when browser sharing is not available.

## Current version

v14 — improves the child-in-care wording so it clearly says the child belongs to the couple, uses entered names throughout the family explanation, hides spouse fields when single is selected, and makes example placeholders lighter with helper notes.

v15 — adds Na’s birthday auto-fill. Typing “Na” in the spouse name field automatically fills October 21, 1970. Typing “Dan” in the main name field automatically fills July 5, 1963.


## Print and save

After clicking **Calculate**, use **Print Results** to print the estimate or **Save Results** to download a plain text copy.


## v18 updates

- Added **Save Progress** and **Load Saved** buttons so you can save the form and keep working later in the same browser.
- Renamed the old result-saving action to **Download Results (HTML report)** so it is clear that it downloads a text report instead of reloading the form.
- Clarified that Social Security calculations for the year begin with the month checks start, such as July through December.
- Added next steps to the printable/downloadable summary, including asking SSA about a spouse child-in-care benefit for a child under 16.
- Clarified spouse benefit vs child benefit fields so users do not accidentally double-count one SSA estimate.


## Download Results filename

The downloaded HTML estimate uses the primary Social Security worker's name plus the current date and time, for example `ss-calc-pwa-Dan-2026-05-04_17-30.html`.


## v22 updates

- Improved smartphone responsiveness with larger tap targets, single-column layouts, and full-width action buttons on small screens.
- Added **Share App** button for sending the app link to friends.
- Updated the service worker cache to v22.
