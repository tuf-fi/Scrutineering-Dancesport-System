# Putting BIS Online: What You Need and What It Costs

BIS has two parts. The **venue laptop** runs the competition on the day, with no internet. The **online server** lets clubs register and pay before the event, and shows public results afterwards. This paper is about the online server.

The accounts below need a bank card. The organizer types their own card details and passwords, and I never keep them.

## Cost in Philippine pesos

DigitalOcean and the domain seller charge in US dollars, so the peso amount depends on the exchange rate on the day you pay. The amounts below use **₱62 to the dollar**. Your card statement may differ by a few pesos.

| Item | What it is for | Per month | Per year |
| --- | --- | --- | --- |
| Online server, 2 GB size, 1 CPU, 50 GB disk (DigitalOcean, listed at 12 US dollars a month) | Space you rent on DigitalOcean's internet servers to keep the website running 24 hours a day. Clubs register and pay on it, and the public sees results on it. | ₱744 | ₱8,928 |
| Domain name (.com, GoDaddy) | The website address, for example `bis-bicol.com`, so clubs can find the site. | n/a | ₱1,099 (regular price) |
| Backup storage (Backblaze B2) | A safe copy of the data kept away from the server, in case the server is lost. | ₱0 while the database is small | ₱0 |
| Sentry, error tracking (free plan) | Reports errors as they happen, so I can fix a problem before clubs complain. | ₱0 | ₱0 |
| UptimeRobot, alerts when the site is down (free plan) | Checks every few minutes that the site is up, and emails you if it is not. | ₱0 | ₱0 |
| Cloudflare, DNS and protection (free plan) | Directs the domain to the server and blocks bad traffic before it reaches the website. | ₱0 | ₱0 |
| **Total** | | **₱744** | **₱10,027** |

**Domain options at GoDaddy (.com):**

| Option | Length | Year 1 | Years 2 and 3 | Total |
| --- | --- | --- | --- | --- |
| Regular | 1 year | ₱1,099 | n/a | ₱1,099 |
| Promo | 3 years | ₱1 | ₱1,099 each (assumed; read the terms at checkout) | ₱2,199 |

The promo's ₱1 applies to the first year only and needs the 3-year commitment. The yearly total above uses the regular ₱1,099.

- The server price was checked on DigitalOcean's pricing page. The domain price is what GoDaddy showed for a .com.
- Your bank may add a 1% to 3% fee for paying in a foreign currency (about ₱90 to ₱270 a year on the server).
- A new DigitalOcean account sometimes comes with free credit, depending on the offer at the time.

## Step by step

### What access I need, and why

You do not have an IT person, so I need access to every tool below to set up the website and look after it. If something breaks during an event, I can fix it without waiting for you to find a password or a screen.

| Tool | What I can do with access | Why I need it |
| --- | --- | --- |
| DigitalOcean (server) | Create the server, install BIS, update it and restart it | The website runs on it. If it stops, only someone in the account can bring it back |
| Domain (GoDaddy or Namecheap) | Point the website address to the server | The address does not open the site until this is done, and a wrong setting takes the site offline |
| Backblaze (backup storage) | Check that the daily backup copy is arriving | A backup nobody checks may not be working when it is needed |
| Sentry | Read error reports | It shows what went wrong, so I can fix it quickly |
| Cloudflare | Manage the domain's DNS and protection | A change here affects whether the website opens |
| UptimeRobot | Get the same "site is down" alert you get | I hear about a problem at the same time as you |

What stays with you:

- You own every account and the card. I never see your card number.
- You can remove me from any tool at any time.
- I never ask for your passwords. You invite me instead.

### Part A: Online server (DigitalOcean)

1. Go to **digitalocean.com** and press **Sign up**. Use an email address the organizer will keep for years, not a personal one that may change. Choose a strong password.
2. Open the email DigitalOcean sends and confirm your address.
3. When asked for a payment method, add the organizer's **debit or credit card** (Visa or Mastercard). PayPal also works. The card must be allowed to pay online in a foreign currency: if it is declined, call your bank and ask them to allow international online payments. The card is not charged on the spot. DigitalOcean bills at the end of each month, and your bank may hold a small test amount of about ₱60.
4. Give the account a name, for example "BIS Bicol".
5. Do not create the server yourself. Go to **Settings, then Team**, press **Invite members**, and enter my email: **code.besaytejomarkristoffer@gmail.com**. Give me a role that can create and manage the server. I then set up the server. You can remove me at any time from the same page.
6. Under **Billing**, check that the card is saved and set a **billing alert** (for example ₱1,200) so you hear about unexpected charges.

### Part B: Website address (domain)

1. Go to a domain seller such as **godaddy.com** or **namecheap.com**. Make an account the same way as in Part A.
2. Search for the name you want, for example `bis-bicol.com`. Pick a short, easy name that you can say out loud.
3. Buy it for **1 year** (or the 3-year offer, if you accept its terms) and pay with the card or PayPal. Turn on **auto-renew** so the site does not go offline when the year ends.
4. Add me to the domain account. Look in the account settings for an option to share access with another person (GoDaddy calls it **Delegate Access**; the name differs by seller) and enter my email. I then set the **DNS** record myself, so you do not need to edit any settings.

### Part C: Backup storage (optional, recommended)

1. Go to **backblaze.com** and create a **B2 Cloud Storage** account. It also asks for a card.
2. Create a bucket (a folder) named for the event, for example `bis-backups`, and keep it **private**.
3. Invite me to the account if it has a team option. If it does not, create the account together with me on a call. Either way, create an **application key** for that bucket and send the key and its ID to me through a private message, not by email, and not in a group chat.

### Part D: Free tools that help the website (optional)

All three have a free plan that is enough for BIS. Plans and limits can change, so check each one when you sign up. Each one is created by the organizer, who gives me access, as in Part A.

| Tool | What it does | Cost | Setup |
| --- | --- | --- | --- |
| **Sentry** (sentry.io) | Reports errors as they happen, with details, so I can fix a problem before clubs complain. | ₱0 on the free plan | Needs a small addition to BIS's code, which I will do. You only create the account and invite me as a member. |
| **UptimeRobot** (uptimerobot.com) | Checks every few minutes that the site is up, and emails you if it goes down. | ₱0 on the free plan | Enter the website address and your email. Add my email as a second alert contact, so I hear when the site goes down. |
| **Cloudflare** (cloudflare.com) | Free DNS for the domain, plus protection against attacks and bad traffic in front of the website. | ₱0 on the free plan | Create the account and invite me as a member. I move the domain's DNS to Cloudflare and test it before the event. |

Sentry needs one change to BIS first (not built yet). UptimeRobot works from day one, because BIS already has a health page at `/api/health`.

### Part E: My side (the developer)

After the accounts are ready, I will:

1. Create the server, install BIS and connect the domain. The address then opens with a padlock (HTTPS).
2. Create the first **admin** login and give it to you. You sign in and change the password right away.
3. In BIS, open **Fees and payment details** and enter the entry fees and your GCash, Maya and bank account details. Clubs cannot register until the fees are saved.
4. Connect the venue laptop, and turn on the daily backup copy.

## Keeping it safe

- Use a different, strong password for each account, and turn on **two-step sign-in** (a code sent to your phone) in all of them.
- Do not send passwords or card numbers by email or chat. Invite people to the account instead.
- When the project ends, closing the DigitalOcean account stops all charges.
- Keep a note of when each payment renews: the server monthly, the domain yearly.
