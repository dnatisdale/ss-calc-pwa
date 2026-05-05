const $ = (id) => document.getElementById(id);
const moneyIds = [
  'mainMonthlySS','mainEarnedIncome','mainVADisability','mainOtherIncome',
  'spouseFamilyBenefit','spouseEarnedIncome','spouseOwnSS','spouseVA','spouseOther','childBenefit'
];
const sections = [
  { id: 'familySection', status: 'familyStatus', groups: ['family', 'family-spouse'] },
  { id: 'mainMoneySection', status: 'mainMoneyStatus', groups: ['main-money'] },
  { id: 'spouseSection', status: 'spouseStatus', groups: ['spouse', 'spouse-money'] },
  { id: 'childSection', status: 'childStatus', groups: ['child', 'child-if-yes'] }
];

const EARNINGS_LIMITS = {
  2026: { underFra: 24480, fraYear: 65160, monthlyUnderFra: 2040, monthlyFraYear: 5430 }
};

let deferredPrompt = null;
const STORAGE_KEY = 'ss-calc-pwa-progress-v22';

const KNOWN_BIRTHDAYS = {
  dan: '1963-07-05',
  na: '1970-10-21'
};

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function maybeFillKnownBirthday(nameInputId, birthInputId) {
  const nameKey = normalizeName($(nameInputId).value);
  const birthday = KNOWN_BIRTHDAYS[nameKey];
  const birthInput = $(birthInputId);
  if (birthday && !birthInput.value) {
    birthInput.value = birthday;
  }
}

function applyKnownBirthdays() {
  maybeFillKnownBirthday('mainName', 'mainBirthdate');
  maybeFillKnownBirthday('spouseName', 'spouseBirthdate');
}


function isNA(value) {
  return String(value || '').trim().toLowerCase() === 'n/a' || String(value || '').trim().toLowerCase() === 'na';
}

function hasValue(el) {
  if (!el || el.closest('.hidden')) return true;
  return String(el.value || '').trim().length > 0;
}

function moneyToNumber(value) {
  if (isNA(value) || String(value || '').trim() === '') return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value) {
  const n = Math.round(Number(value) || 0);
  const abs = Math.abs(n).toLocaleString('en-US');
  return n < 0 ? `-$${abs}` : `$${abs}`;
}

function formatMoneyInput(el) {
  const raw = String(el.value || '').trim();
  if (!raw || isNA(raw)) {
    if (isNA(raw)) el.value = 'N/A';
    return;
  }
  const n = moneyToNumber(raw);
  el.value = formatMoney(n);
}

function birthToFraYear(birthdate) {
  const year = new Date(birthdate + 'T00:00:00').getFullYear();
  if (!year) return null;
  // Simplified: born 1960 or later = FRA 67. Earlier years are estimated for app friendliness.
  if (year >= 1960) return year + 67;
  if (year === 1959) return year + 66 + 1;
  return year + 66;
}

function getRequiredElementsForGroup(group) {
  if (group === 'family-spouse' && $('maritalStatus').value !== 'married') return [];
  if (group === 'spouse-money' && $('spouseHasMoney').value !== 'yes') return [];
  if (group === 'child-if-yes' && $('hasChild').value !== 'yes') return [];
  return [...document.querySelectorAll(`[data-required="${group}"]`)];
}

function sectionComplete(section) {
  return section.groups.every(group => getRequiredElementsForGroup(group).every(hasValue));
}

function updateNameText() {
  applyKnownBirthdays();
  const mainName = $('mainName').value.trim() || 'the worker';
  const spouseName = $('spouseName').value.trim() || 'the spouse';
  document.querySelectorAll('[data-main-name]').forEach(el => { el.textContent = mainName; });
  document.querySelectorAll('[data-spouse-name]').forEach(el => { el.textContent = spouseName; });
  const childAgeRaw = $('childAge')?.value?.trim();
  const childAgeText = childAgeRaw && childAgeRaw.toUpperCase() !== 'N/A' ? childAgeRaw : '14';
  document.querySelectorAll('[data-child-age]').forEach(el => { el.textContent = childAgeText; });
}

function updateVisibility() {
  updateNameText();
  const married = $('maritalStatus').value === 'married';
  $('spouseNameWrap').classList.toggle('hidden', !married);
  $('spouseBirthWrap').classList.toggle('hidden', !married);
  $('spouseSection').classList.toggle('hidden', !married);
  const spouseMoney = $('spouseHasMoney').value === 'yes';
  $('spouseMoneyFields').classList.toggle('hidden', !spouseMoney);
  const childYes = $('hasChild').value === 'yes';
  ['childCount','childAge','childBenefit'].forEach(id => $(id).closest('label').classList.toggle('hidden', !childYes));
}

function updateStatuses(autoCollapse = false) {
  updateVisibility();
  for (const section of sections) {
    const el = $(section.id);
    if (el.classList.contains('hidden')) continue;
    const done = sectionComplete(section);
    const status = $(section.status);
    status.textContent = done ? 'Complete' : 'Needs info';
    status.classList.toggle('ok', done);
    if (autoCollapse && done) el.open = false;
    if (!done) el.open = true;
  }
}

function getMissingFields() {
  const fields = [];
  for (const section of sections) {
    const sectionEl = $(section.id);
    if (sectionEl.classList.contains('hidden')) continue;
    for (const group of section.groups) {
      for (const input of getRequiredElementsForGroup(group)) {
        if (!hasValue(input)) {
          const label = input.closest('label')?.childNodes[0]?.textContent?.trim() || input.id;
          fields.push({ input, label, sectionEl });
        }
      }
    }
  }
  return fields;
}

function clearMissingHighlights() {
  document.querySelectorAll('.missing-required').forEach(el => el.classList.remove('missing-required'));
  document.querySelectorAll('.has-missing').forEach(el => el.classList.remove('has-missing'));
}

function jumpToFirstMissingField(missingFields) {
  clearMissingHighlights();
  const first = missingFields[0];
  if (!first) return;
  first.sectionEl.open = true;
  first.input.classList.add('missing-required');
  first.input.closest('label')?.classList.add('has-missing');
  first.input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => first.input.focus({ preventScroll: true }), 350);
}

function calculate() {
  updateStatuses(false);
  const missingFields = getMissingFields();
  const missingBox = $('missingBox');
  if (missingFields.length) {
    jumpToFirstMissingField(missingFields);
    const missingLabels = missingFields.map(item => item.label);
    missingBox.classList.remove('hidden');
    missingBox.innerHTML = `<h3>Please fill this first</h3><p class="missing-jump-note">I jumped to the first required blank and marked it red.</p><p><strong>First missing field:</strong> ${missingLabels[0]}</p><p>Type a real amount, $0, or N/A. The calculator will not guess for you.</p>`;
    $('results').innerHTML = '';
    return;
  }
  clearMissingHighlights();
  missingBox.classList.add('hidden');

  const mainName = $('mainName').value.trim() || 'Main person';
  const spouseName = $('spouseName').value.trim() || 'Spouse';
  const married = $('maritalStatus').value === 'married';
  const year = Number($('claimYear').value) || 2026;
  const claimMonth = Number($('claimMonth').value) || 1;
  const monthNames = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const startMonthName = monthNames[claimMonth] || 'the start month';
  const monthsReceiving = Math.max(0, 13 - claimMonth);
  const monthsBeforeChecks = Math.max(0, claimMonth - 1);
  const mainMonthlySS = moneyToNumber($('mainMonthlySS').value);
  const mainEarned = moneyToNumber($('mainEarnedIncome').value);
  const mainVA = moneyToNumber($('mainVADisability').value);
  const mainOther = moneyToNumber($('mainOtherIncome').value);
  const spouseFamilyMonthly = married ? moneyToNumber($('spouseFamilyBenefit').value) : 0;
  const spouseOwnSS = married && $('spouseHasMoney').value === 'yes' ? moneyToNumber($('spouseOwnSS').value) : 0;
  const spouseEarned = married && $('spouseHasMoney').value === 'yes' ? moneyToNumber($('spouseEarnedIncome').value) : 0;
  const spouseVA = married && $('spouseHasMoney').value === 'yes' ? moneyToNumber($('spouseVA').value) : 0;
  const spouseOther = married && $('spouseHasMoney').value === 'yes' ? moneyToNumber($('spouseOther').value) : 0;
  const childCount = $('hasChild').value === 'yes' ? (Number(String($('childCount').value).replace(/[^0-9]/g,'')) || 0) : 0;
  const childAge = $('hasChild').value === 'yes' ? (Number(String($('childAge').value).replace(/[^0-9]/g,'')) || 0) : 0;
  const childMonthly = $('hasChild').value === 'yes' ? moneyToNumber($('childBenefit').value) * childCount : 0;

  const fraYear = birthToFraYear($('mainBirthdate').value) || (year + 99);
  const underFraAllYear = year < fraYear;
  const limit = underFraAllYear ? (EARNINGS_LIMITS[year]?.underFra || 24480) : (EARNINGS_LIMITS[year]?.fraYear || 65160);
  const over = Math.max(0, mainEarned - limit);
  const rawWithheld = underFraAllYear ? Math.floor(over / 2) : Math.floor(over / 3);

  const mainSSAnnual = mainMonthlySS * monthsReceiving;
  const spouseFamilyAnnual = spouseFamilyMonthly * monthsReceiving;
  const childAnnual = childMonthly * monthsReceiving;
  const benefitsOnMainRecord = mainSSAnnual + spouseFamilyAnnual + childAnnual;
  const estimatedWithheld = Math.min(rawWithheld, benefitsOnMainRecord);
  const possibleSpilloverWithholding = Math.max(0, rawWithheld - benefitsOnMainRecord);

  const spouseOwnSSAnnual = spouseOwnSS * 12;
  const householdWork = mainEarned + spouseEarned;
  const householdVA = (mainVA + spouseVA) * 12;
  const householdOther = (mainOther + spouseOther) * 12;
  const totalBeforeWithholding = householdWork + householdVA + householdOther + mainSSAnnual + spouseFamilyAnnual + childAnnual + spouseOwnSSAnnual;
  const totalAfterWithholding = totalBeforeWithholding - estimatedWithheld;
  const monthlyAvg = totalAfterWithholding / 12;

  const childInCare = married && $('spouseChildInCare').value === 'yes';
  const duplicateFamilyBenefitWarning = married && spouseFamilyMonthly > 0 && childMonthly > 0 && Math.round(spouseFamilyMonthly) === Math.round(childMonthly / Math.max(1, childCount));
  const familyExplain = childInCare
    ? `Because ${mainName} is the eligible worker and ${spouseName} is caring for ${mainName} and ${spouseName}'s child at home, the family should ask SSA about a spouse child-in-care benefit. The youngest child entered is ${childAge || 'under 16/eligible'}, so this may matter before ${spouseName} turns 62.`
    : `${spouseName} may still matter for planning, but this app did not mark a child-in-care spouse situation. A regular spouse benefit usually depends on the spouse being 62 or older, or another qualifying SSA rule.`;

  const socialSecurityAfterWithholding = Math.max(0, mainSSAnnual + spouseFamilyAnnual + childAnnual + spouseOwnSSAnnual - estimatedWithheld);
  const monthlyAvgExplanation = socialSecurityAfterWithholding === 0
    ? `In this estimate, the Social Security/family-benefit part is $0 for the year after withholding. So the monthly average below is coming from the other money you entered, such as work income, VA disability, and other income. It is not a Social Security check amount.`
    : `This number includes the Social Security/family-benefit amount left after withholding, plus the other money you entered, such as work income, VA disability, and other income. It is not the same thing as one monthly Social Security check.`;

  $('results').innerHTML = `
    <div class="result-grid">
      <div class="result-box"><div class="label">Work income</div><div class="value">${formatMoney(householdWork)}</div></div>
      <div class="result-box"><div class="label">Benefits/income before withholding</div><div class="value">${formatMoney(totalBeforeWithholding)}</div></div>
      <div class="result-box"><div class="label">Estimated held back</div><div class="value negative">${formatMoney(-estimatedWithheld)}</div></div>
      <div class="result-box"><div class="label">Estimated yearly cash after withholding</div><div class="value">${formatMoney(totalAfterWithholding)}</div></div>
    </div>
    <div class="steps">
      <h3>Plain-English walkthrough</h3>
      <ol>
        <li>${mainName}'s earned income entered for ${year} is ${formatMoney(mainEarned)}.</li>
        <li>The ${year} earnings-test limit used here is ${formatMoney(limit)}. This is the limit before Social Security starts holding back checks.</li>
        <li>The amount over the limit is ${formatMoney(over)}.</li>
        <li>The estimated amount SSA may hold back from benefits on ${mainName}'s record is shown as ${formatMoney(-estimatedWithheld)} because it subtracts from this year's cash flow.</li>
        <li>VA disability is added to the family cash picture, but it is not counted as earned work income for this earnings-test estimate.</li>
      </ol>
    </div>
    <div class="explain">
      <h3>Spouse and child note for this family</h3>
      <p>${familyExplain}</p>
      <p><strong>Ask SSA this exact question:</strong> “If ${mainName} starts Social Security retirement now, can ${spouseName} receive a spouse child-in-care benefit because ${spouseName} is caring for our child who is under 16?”</p>
      <p>A child benefit and a spouse child-in-care benefit may be affected by the family maximum and by earnings-test withholding on ${mainName}'s record. This app is a planning tool, not SSA's final decision.</p>
    </div>
    <div class="explain">
      <h3>Not gone forever — but the timing matters</h3>
      <p>Money held back by the earnings test is not usually gone forever. At full retirement age, SSA recalculates the monthly benefit to give credit for months when checks were withheld. It normally comes back slowly through a higher monthly check, not as one simple refund.</p>
      <div class="simple-total">
        <h4>Based on the start month you chose: ${startMonthName}</h4>
        <p>This section uses the <strong>Social Security starts in what month?</strong> field above. For ${year}, it counts only the checks from <strong>${startMonthName} through December</strong>. If you change the start month, these numbers update the next time the estimate refreshes.</p>
        <div class="math-line"><span>Months before ${mainName}'s checks start</span><strong>${monthsBeforeChecks}</strong></div>
        <div class="math-line"><span>Months with possible Social Security/family checks this year</span><strong>${monthsReceiving}</strong></div>
        <div class="math-line"><span>Benefits on ${mainName}'s record for those ${monthsReceiving} month(s)</span><strong>${formatMoney(benefitsOnMainRecord)}</strong></div>
        <div class="math-line"><span>Estimated SSA withholding that can be taken from those ${monthsReceiving} month(s)</span><strong>${formatMoney(-estimatedWithheld)}</strong></div>
      </div>
      ${possibleSpilloverWithholding > 0 ? `<p class="plain-warning"><strong>Important:</strong> the earnings-test formula estimated more withholding than the benefits available from ${startMonthName} through December. This app only subtracts the benefits shown for this calendar year. Ask SSA whether any extra withholding affects later checks.</p>` : ''}
      <div class="simple-total">
        <h4>What the monthly average means</h4>
        <p><strong>${formatMoney(monthlyAvg)} per month is a budget average for the whole family.</strong></p>
        <p>It is <strong>not</strong> one Social Security check. It spreads the whole year’s money evenly across 12 months. That includes yearly work income, VA disability, other income, and only the Social Security/family benefits that begin in ${startMonthName}. Then it subtracts possible SSA withholding.</p>
        <div class="math-line"><span>Estimated yearly family cash after withholding</span><strong>${formatMoney(totalAfterWithholding)}</strong></div>
        <div class="math-line"><span>Spread across the whole year</span><strong>÷ 12</strong></div>
        <div class="math-line total"><span>Budget average per month</span><strong>${formatMoney(monthlyAvg)}</strong></div>
      </div>
      <p>${monthlyAvgExplanation}</p>
      <ul class="mini-list">
        <li><strong>Social Security/family benefits left after withholding:</strong> ${formatMoney(socialSecurityAfterWithholding)} for the year.</li>
        <li><strong>Work income included:</strong> ${formatMoney(householdWork)} for the year.</li>
        <li><strong>VA disability included:</strong> ${formatMoney(householdVA)} for the year.</li>
        <li><strong>Other income included:</strong> ${formatMoney(householdOther)} for the year.</li>
      </ul>
      <p class="plain-warning"><strong>Bottom line:</strong> Read ${formatMoney(monthlyAvg)} as “our estimated average family cash per month for the year after possible SSA withholding.” Do not read it as “my monthly Social Security check.”</p>
    </div>
    <div class="explain next-steps">
      <h3>Next steps before filing</h3>
      <ol>
        <li>Call SSA and ask: “If ${mainName} starts Social Security retirement now, can ${spouseName} receive a spouse child-in-care benefit because ${spouseName} is caring for our child who is under 16?”</li>
        <li>Ask SSA for separate estimates for: ${mainName}'s retirement benefit, ${spouseName}'s spouse child-in-care benefit, and the child benefit.</li>
        <li>Ask whether the family maximum reduces any spouse or child amounts.</li>
        <li>Ask how earnings-test withholding will be applied if checks start in ${startMonthName}.</li>
      </ol>
      ${duplicateFamilyBenefitWarning ? `<p class="plain-warning"><strong>Double-count check:</strong> You entered the same monthly amount for the spouse benefit and the child benefit. That can be correct only if SSA gave you two separate benefit amounts. If SSA gave one combined family amount, enter it only once and put N/A in the other field.</p>` : ''}
    </div>
  `;
  updateStatuses(true);
}

function clearMain() {
  ['mainName','mainBirthdate','claimMonth','mainMonthlySS','mainEarnedIncome','mainVADisability','mainOtherIncome'].forEach(id => $(id).value = '');
  $('results').innerHTML = '';
  updateStatuses(false);
}

function clearSpouse() {
  ['spouseName','spouseBirthdate','spouseHasMoney','spouseChildInCare','spouseFamilyBenefit','spouseEarnedIncome','spouseOwnSS','spouseVA','spouseOther'].forEach(id => $(id).value = '');
  $('results').innerHTML = '';
  updateStatuses(false);
}

function setupInstall() {
  const btn = $('installBtn');
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    btn.textContent = 'Install App';
  });
  btn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      $('installHelpSection').open = true;
      $('installHelpSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });
}


function printResults() {
  const results = $('results');
  if (!results.innerHTML.trim()) {
    $('missingBox').classList.remove('hidden');
    $('missingBox').innerHTML = '<h3>Nothing to print yet</h3><p>Click Calculate first. Then Print Results will print the estimate.</p>';
    $('calculateBtn').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  window.print();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDateForReport(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return value || 'N/A';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function fieldValueForReport(id) {
  const el = $(id);
  if (!el) return 'N/A';
  if (el.tagName === 'SELECT') {
    const selected = el.options[el.selectedIndex];
    return selected ? selected.text.trim() : 'N/A';
  }
  const raw = el.value.trim();
  if (!raw) return 'N/A';
  if (el.type === 'date') return formatDateForReport(raw);
  return raw;
}

function reportRow(label, id) {
  const value = fieldValueForReport(id);
  const answerClass = String(value).toUpperCase() === 'N/A' ? 'answer-line na-answer' : 'answer-line';
  return `<tr><th>${escapeHtml(label)}</th><td><span class="${answerClass}">${escapeHtml(value)}</span></td></tr>`;
}

function buildInputReportHtml() {
  const married = $('maritalStatus').value === 'married';
  const spouseHasMoney = $('spouseHasMoney').value === 'yes';
  const hasChild = $('hasChild').value === 'yes';
  const mainName = fieldValueForReport('mainName');
  const spouseName = married ? fieldValueForReport('spouseName') : '';

  const sections = [];
  sections.push(`
    <section class="report-section">
      <h2><span class="under-title">Family setup</span></h2>
      <table>
        ${reportRow('Single or married?', 'maritalStatus')}
        ${reportRow('Your name', 'mainName')}
        ${married ? reportRow('Spouse name', 'spouseName') : ''}
        ${reportRow(`${mainName}'s birthdate`, 'mainBirthdate')}
        ${married ? reportRow(`${spouseName}'s birthdate`, 'spouseBirthdate') : ''}
      </table>
    </section>`);

  sections.push(`
    <section class="report-section">
      <h2><span class="under-title">${mainName}'s money details</span></h2>
      <table>
        ${reportRow('Planning year', 'claimYear')}
        ${reportRow('Social Security starts in what month?', 'claimMonth')}
        ${reportRow('Estimated monthly Social Security before withholding', 'mainMonthlySS')}
        ${reportRow('Earned income from work this year', 'mainEarnedIncome')}
        ${reportRow('VA disability per month', 'mainVADisability')}
        ${reportRow('Other non-work income per month', 'mainOtherIncome')}
      </table>
    </section>`);

  if (married) {
    sections.push(`
      <section class="report-section">
        <h2><span class="under-title">${spouseName}'s spouse / family-benefit details</span></h2>
        <table>
          ${reportRow('Does the spouse have paid income or benefits to enter?', 'spouseHasMoney')}
          ${reportRow('Is the spouse caring for a child under 16 or disabled?', 'spouseChildInCare')}
          ${reportRow('Estimated spouse benefit per month', 'spouseFamilyBenefit')}
          ${spouseHasMoney ? reportRow('Spouse earned income from paid work this year', 'spouseEarnedIncome') : ''}
          ${spouseHasMoney ? reportRow('Spouse own Social Security per month', 'spouseOwnSS') : ''}
          ${spouseHasMoney ? reportRow('Spouse VA disability per month', 'spouseVA') : ''}
          ${spouseHasMoney ? reportRow('Spouse other income per month', 'spouseOther') : ''}
        </table>
      </section>`);
  }

  sections.push(`
    <section class="report-section">
      <h2><span class="under-title">Child / dependent details</span></h2>
      <table>
        ${reportRow('Do you have an eligible child/dependent to include?', 'hasChild')}
        ${hasChild ? reportRow('Number of eligible children/dependents', 'childCount') : ''}
        ${hasChild ? reportRow('Youngest child age', 'childAge') : ''}
        ${hasChild ? reportRow('Estimated child benefit per child per month', 'childBenefit') : ''}
      </table>
    </section>`);

  return sections.join('\n');
}

function buildHtmlReport() {
  const results = $('results');
  const savedAt = new Date().toLocaleString();
  const clonedResults = results.cloneNode(true);
  clonedResults.querySelectorAll('button, input, select, textarea, script').forEach(el => el.remove());

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SS Calc PWA Estimate</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #15272c; line-height: 1.45; margin: 28px; background: #fffaf0; }
    .report-page { max-width: 980px; margin: 0 auto; background: #fff; border: 1px solid #ddd1b5; border-radius: 18px; padding: 24px; }
    h1 { margin: 0 0 4px; font-size: 30px; }
    h2 { font-size: 20px; margin: 26px 0 10px; }
    h3 { margin-top: 20px; }
    .saved { color: #5d6b70; margin-top: 0; }
    .under-title { border-bottom: 3px solid #385f4f; padding-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 18px; }
    th, td { vertical-align: top; padding: 10px; border-bottom: 1px solid #eadfc8; }
    th { width: 42%; color: #334; font-weight: 700; text-align: left; }
    td { text-align: right; }
    .answer-line { display: inline-block; min-width: 210px; max-width: 100%; border-bottom: 2px solid #15272c; padding: 0 4px 2px; text-align: right; }
    .na-answer { text-align: center; }
    .results-report { margin-top: 26px; padding-top: 10px; border-top: 4px double #385f4f; }
    .result-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin: 14px 0; }
    .result-box, .simple-total { border: 1px solid #ddd1b5; border-radius: 12px; padding: 12px; background: #fffdf8; }
    .label { font-size: 13px; color: #59666b; }
    .value { font-size: 22px; margin-top: 4px; }
    .negative { color: #9d2f25; }
    .steps { background: #eaf5ee; border-radius: 14px; padding: 14px; margin: 14px 0; }
    .explain { background: #fff6d9; border-radius: 14px; padding: 14px; margin: 14px 0; }
    .math-line { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e2d6bd; padding: 8px 0; }
    .math-line.total { font-weight: 700; }
    .plain-warning { border-left: 4px solid #385f4f; background: #fff; padding: 10px; border-radius: 8px; }
    .footer-note { margin-top: 24px; font-size: 13px; color: #5d6b70; border-top: 1px solid #ddd1b5; padding-top: 14px; }
    @media print { body { background: #fff; margin: 12px; } .report-page { border: none; padding: 0; } }
  </style>
</head>
<body>
  <main class="report-page">
    <h1>SS Calc PWA Estimate</h1>
    <p class="saved">Saved: ${escapeHtml(savedAt)}</p>
    <section>
      <h2><span class="under-title">Filled-out sections and details</span></h2>
      <p>The underlined items are the values entered in the calculator when this report was downloaded.</p>
      ${buildInputReportHtml()}
    </section>
    <section class="results-report">
      <h2><span class="under-title">Estimated Family Results</span></h2>
      ${clonedResults.innerHTML}
    </section>
    <p class="footer-note">Planning tool only. Verify final filing choices, benefit amounts, family maximum rules, and earnings-test withholding with Social Security.</p>
  </main>
</body>
</html>`;
}

function safeFilePart(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || fallback;
}

function reportTimestampForFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day}_${hour}-${minute}`;
}

function buildReportFilename() {
  const workerName = safeFilePart($('mainName')?.value, 'primary-worker');
  return `ss-calc-pwa-${workerName}-${reportTimestampForFilename()}.html`;
}

function downloadResults() {
  const results = $('results');
  if (!results.innerHTML.trim()) {
    $('missingBox').classList.remove('hidden');
    $('missingBox').innerHTML = '<h3>Nothing to download yet</h3><p>Click Calculate first. Then Download Results will save an HTML report of the estimate.</p>';
    $('calculateBtn').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const html = buildHtmlReport();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildReportFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}



function getShareUrl() {
  const url = new URL(window.location.href);
  url.hash = '';
  return url.href;
}

async function shareApp() {
  const shareData = {
    title: 'SS Calc PWA',
    text: 'Try this simple Social Security family planning calculator.',
    url: getShareUrl()
  };
  const box = $('missingBox');
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      await navigator.share(shareData);
      return;
    }
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareData.url);
      box.classList.remove('hidden');
      box.classList.remove('danger');
      box.classList.add('soft');
      box.innerHTML = '<h3>App link copied</h3><p>The SS Calc PWA link was copied. You can paste it into a text, email, or message to a friend.</p>';
      setTimeout(() => { box.classList.add('hidden'); box.classList.add('danger'); box.classList.remove('soft'); }, 4000);
      return;
    }
    window.prompt('Copy this SS Calc PWA link:', shareData.url);
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    window.prompt('Copy this SS Calc PWA link:', shareData.url);
  }
}

function getFormState() {
  const state = {};
  document.querySelectorAll('input, select').forEach(el => { state[el.id] = el.value; });
  return state;
}

function applyFormState(state) {
  if (!state || typeof state !== 'object') return;
  Object.entries(state).forEach(([id, value]) => {
    const el = $(id);
    if (el) el.value = value;
  });
  applyKnownBirthdays();
  updateStatuses(false);
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getFormState()));
  const box = $('missingBox');
  box.classList.remove('hidden');
  box.classList.remove('danger');
  box.classList.add('soft');
  box.innerHTML = '<h3>Progress saved</h3><p>Your entries were saved in this browser on this computer. Use Load Saved later to keep working.</p>';
  setTimeout(() => { box.classList.add('hidden'); box.classList.add('danger'); box.classList.remove('soft'); }, 3500);
}

function loadProgress() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const box = $('missingBox');
  if (!saved) {
    box.classList.remove('hidden');
    box.innerHTML = '<h3>No saved progress found</h3><p>Use Save Progress first. Saved progress stays in this browser on this computer.</p>';
    return;
  }
  applyFormState(JSON.parse(saved));
  document.querySelectorAll('details').forEach(d => d.open = true);
  box.classList.remove('hidden');
  box.classList.remove('danger');
  box.classList.add('soft');
  box.innerHTML = '<h3>Saved progress loaded</h3><p>Your saved entries are back in the form. You can keep editing or click Calculate.</p>';
  setTimeout(() => { box.classList.add('hidden'); box.classList.add('danger'); box.classList.remove('soft'); }, 3500);
}


function refreshResultsIfShowing() {
  const results = $('results');
  if (!results || !results.innerHTML.trim()) return;
  // Keep the results tied to the current inputs, but do not jump around while the user is typing a missing value.
  updateStatuses(false);
  if (getMissingFields().length === 0) calculate();
}

function init() {
  moneyIds.forEach(id => $(id).addEventListener('blur', e => formatMoneyInput(e.target)));
  document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', () => {
    el.classList.remove('missing-required');
    el.closest('label')?.classList.remove('has-missing');
    if (el.id === 'mainName' || el.id === 'spouseName') applyKnownBirthdays();
    updateStatuses(false);
    refreshResultsIfShowing();
  }));
  document.querySelectorAll('select').forEach(el => el.addEventListener('change', () => {
    el.classList.remove('missing-required');
    el.closest('label')?.classList.remove('has-missing');
    updateStatuses(false);
    refreshResultsIfShowing();
  }));
  $('calculateBtn').addEventListener('click', calculate);
  $('printBtn').addEventListener('click', printResults);
  $('saveBtn').addEventListener('click', downloadResults);
  $('saveProgressBtn').addEventListener('click', saveProgress);
  $('shareBtn').addEventListener('click', shareApp);
  $('loadProgressBtn').addEventListener('click', loadProgress);
  $('openAllBtn').addEventListener('click', () => document.querySelectorAll('details').forEach(d => d.open = true));
  $('clearMainBtn').addEventListener('click', clearMain);
  $('clearSpouseBtn').addEventListener('click', clearSpouse);
  setupInstall();
  applyKnownBirthdays();
  updateStatuses(false);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
}

init();
