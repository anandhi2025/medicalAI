# Medical Research Assistant Frontend

This folder contains a React + Vite frontend for the Medical Research Assistant.

## Setup

1. Open a terminal in `d:\backend\medical`
2. Run `npm install`
3. Run `npm run dev`

## Usage

- Open the Vite dev server URL shown in the terminal.
- Enter a disease, research query, and optional location.
- Click **Run Research** to query the backend at `/ask`.
- The app displays structured publications, clinical trials, and the assistant response.

## Notes

- The frontend uses `/ask` proxy to `http://localhost:5000`.
- Make sure the backend is running on port `5000`.
