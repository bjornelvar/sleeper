const API_BASE = "https://api.sleeper.app/v1";

const form = document.getElementById("search-form");
const submitBtn = form.querySelector("button");
const errorDiv = document.getElementById("error");
const leagueList = document.getElementById("league-list");
const seasonHint = document.getElementById("season-hint");
const input = document.getElementById("sleeper-name");
const SAVED_KEY = "sleeperUsername";

function computeSeasonYear(d = new Date()) {
  // Season runs Aug 31 (Y) -> Aug 30 (Y+1). If today >= Aug 31 this year, season = this year; else prev year.
  const y = d.getFullYear();
  const seasonStartThisYear = new Date(y, 7, 31); // month is 0-based: 7 = August
  return d >= seasonStartThisYear ? y : y - 1;
}

const seasonYear = computeSeasonYear();
if (seasonHint) seasonHint.textContent = `Enter your Sleeper username to see your ${seasonYear} leagues.`;

form.addEventListener("submit", async e => {
  e.preventDefault();
  errorDiv.textContent = "";
  leagueList.innerHTML = "";
  leagueList.classList.add("hidden");
  submitBtn.disabled = true;
  submitBtn.textContent = "Finding leagues…";

  const username = input.value.trim();

  try {
    const resUser = await fetch(`${API_BASE}/user/${encodeURIComponent(username)}`);
    const user = resUser.ok ? await resUser.json() : null;
    if (!user?.user_id) throw new Error(`No Sleeper user named "${username}". Check the spelling and try again.`);
    try { localStorage.setItem(SAVED_KEY, username); } catch {}

    const resLeagues = await fetch(`${API_BASE}/user/${user.user_id}/leagues/nfl/${seasonYear}`);
    if (!resLeagues.ok) throw new Error(`Couldn't load leagues (${resLeagues.status}). Try again.`);
    const leagues = await resLeagues.json();
    if (!leagues.length) throw new Error(`${username} has no NFL leagues for ${seasonYear}.`);

    for (const l of leagues) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `league.html?leagueId=${l.league_id}&leagueName=${encodeURIComponent(l.name)}`;
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = l.name;
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = `${l.total_rosters} teams`;
      a.append(name, meta);
      li.appendChild(a);
      leagueList.appendChild(li);
    }
    leagueList.classList.remove("hidden");
  } catch (err) {
    errorDiv.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Find leagues";
  }
});

// Returning visitor: prefill the last username that worked and load its leagues straight away.
let saved = null;
try { saved = localStorage.getItem(SAVED_KEY); } catch {}
if (saved) {
  input.value = saved;
  form.requestSubmit();
}
