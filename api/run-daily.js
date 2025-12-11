// api/run-daily.js (ES module)
import fetch from "node-fetch";
import nodemailer from "nodemailer";

/*
  Environment variables required (set in Vercel dashboard):
  - FIREBASE_DB_URL   e.g. https://YOUR_PROJECT-default-rtdb.firebaseio.com
  - EMAIL_USER        e.g. yourgmail@gmail.com
  - EMAIL_PASS        e.g. 16-character App Password from Google (or SMTP password)
  - FROM_NAME         (optional) name to show in 'From' header
  - FROM_EMAIL        (optional) verified sender, default to EMAIL_USER
*/

const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const FROM_NAME = process.env.FROM_NAME || "Your Name";
const FROM_EMAIL = process.env.FROM_EMAIL || EMAIL_USER;

if (!FIREBASE_DB_URL || !EMAIL_USER || !EMAIL_PASS) {
  console.warn("Missing env vars; set FIREBASE_DB_URL, EMAIL_USER, EMAIL_PASS");
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Helper: compute YYYY-MM-DD string for today's date in UTC (we treat dates as local-ish)
function todayISO() {
  const d = new Date();
  // Use local date so the user sees local due-dates; change to UTC if you prefer:
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Add months safely, preserving day when possible
function addOneMonth(dateStr) {
  const d = new Date(dateStr);
  const origDay = d.getDate();
  d.setMonth(d.getMonth() + 1);
  // if month rollover changed the day (e.g., Feb 30th -> Mar 2nd), clamp to last day:
  if (d.getDate() !== origDay) {
    d.setDate(0); // last day of previous month
  }
  return d.toISOString().slice(0,10);
}

export default async function handler(req, res) {
  // Only allow GET (Vercel cron will be GET)
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const today = todayISO();

    // Read clients from Realtime DB via REST (append .json)
    const url = `${FIREBASE_DB_URL.replace(/\/$/, "")}/clients.json`;
    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      console.error("Firebase read failed", r.status, text);
      return res.status(500).send("Failed to read database");
    }
    const clients = await r.json() || {};

    const results = [];
    for (const [id, c] of Object.entries(clients)) {
      try {
        // determine dueDate to compare
        let dueDate = c.nextDueDate || null;
        if (!dueDate && c.dueDay && c.billingType === "monthly") {
          // build this month's date safely; cap at 28 if needed
          const d = new Date();
          const day = Math.min(Number(c.dueDay), 28);
          d.setDate(day);
          dueDate = d.toISOString().slice(0,10);
        }

        if (!dueDate) continue;

        const lastReminded = c.lastReminded || null;

        // remind if dueDate <= today and not already reminded today
        if (dueDate <= today && lastReminded !== today) {
          // send email
          const text = `Hello ${c.name},\n\nThis is a friendly reminder that payment of ${c.amount} is due on ${dueDate}.\n\nThanks,\n${FROM_NAME}`;
          const html = `<p>Hello ${c.name},</p><p>This is a friendly reminder that payment of <strong>${c.amount}</strong> is due on <strong>${dueDate}</strong>.</p><p>Thanks,<br/>${FROM_NAME}</p>`;
          await transporter.sendMail({
            from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
            to: c.email,
            subject: `Payment reminder — ${c.name}`,
            text,
            html
          });

          // update lastReminded (and bump nextDueDate for monthly if provided)
          const updates = { lastReminded: today };
          if (c.billingType === "monthly" && c.nextDueDate) {
            updates.nextDueDate = addOneMonth(c.nextDueDate);
          }
          // write update back to Firebase via REST (PATCH)
          const patchUrl = `${FIREBASE_DB_URL.replace(/\/$/, "")}/clients/${id}.json`;
          await fetch(patchUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates)
          });

          results.push({ id, email: c.email, status: "sent" });
        }
      } catch (innerErr) {
        console.error("client processing error", id, innerErr);
        results.push({ id, error: String(innerErr) });
      }
    }

    console.log("daily-run results:", results);
    return res.status(200).json({ ok: true, date: today, results });
  } catch (err) {
    console.error("handler error", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
