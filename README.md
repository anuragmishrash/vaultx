# VAULT - My Spend Analyzer Web App

VAULT is a comprehensive, feature-rich web application designed for personal finance tracking, spending analysis, and proactive budgeting. Built with the MERN stack (MongoDB, Express, React, Node.js), VAULT goes beyond simple expense tracking by introducing psychological spending concepts like "Regret Tracking," "True Free Money," and an ongoing "Zero-Day Streak" to gamify saving.

## Features

- **True Free Money Calculation**: Automatically rolls over your unspent monthly budget as "Carry-Forward" money, so you know exactly how much discretionary capital you actually have without dipping into next month's pool.
- **Dynamic Dashboard & KPIs**: 
  - Time-synced top-level KPIs (Spent, Pool Remaining, Regret Score, etc.) that filter by *This Month*, *Last Month*, *3 Months*, and *All Time*.
  - Real-time early spending estimates and predictive overshoot alerts based on current trajectory.
- **Regret Tracker**: Rate your recent transactions to build a "Regret Score." The app highlights your "Top Regret Category" so you can identify patterns in wasteful spending.
- **Zero-Day Streak Engine**: A continuous counter that rewards you for going consecutive days without logging a non-essential transaction.
- **Cash Envelope System**: Dedicate a separate offline cash pool and track ATM withdrawals against it.
- **Modern UI/UX**: Built with React, Vite, and Tailwind CSS, featuring fluid animations via Framer Motion and high-performance interactive charts powered by Recharts.

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion, Recharts, React Query, Zustand
- **Backend**: Node.js, Express.js, MongoDB (Mongoose), JWT Authentication, Bcrypt
- **Architecture**: Monorepo structure with separated `client` and `server` environments.

## Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas account (or local MongoDB instance)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/anuragmishrash/vaultx.git
   cd vaultx
   ```

2. **Backend Setup:**
   ```bash
   cd server
   npm install
   ```
   Create a `.env` file in the `server` directory using the provided `.env.example` as a template. Add your MongoDB URI and JWT secrets.
   ```bash
   npm run dev
   ```

3. **Frontend Setup:**
   Open a new terminal window:
   ```bash
   cd client
   npm install
   ```
   Create a `.env` file in the `client` directory using `.env.example` as a template.
   ```bash
   npm run dev
   ```

4. **Access the App:**
   Open your browser and navigate to `http://localhost:5173`.

## Contributing
Feel free to open issues or submit pull requests for features or bug fixes!
