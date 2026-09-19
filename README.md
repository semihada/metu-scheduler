# METU Scheduler

[![Official App](https://img.shields.io/badge/Official_App-Launch-CB0000?style=for-the-badge&logo=github&logoColor=white)](https://semihada.github.io/metu-scheduler/)

A schedule planner for METU students. Its React scheduling interface is adapted from the MIT-licensed Bilkent Scheduler project; its METU SIS data flow is based on the open-source `robotdegilim.xyz` scraper.
Auto-updates course offerings every two hours.

[Open Metu Scheduler](https://semihada.github.io/metu-scheduler/)

## Run

```powershell
npm install
npm start
```

The project currently uses `react-scripts` 3 (Webpack 4). Its start and build
commands automatically enable Node's OpenSSL legacy provider so they also work
with modern Node versions, including Node 24.

The app starts with a small sample of the Fall 2026-2027 offering file, so it is usable before a live scrape.

## Refresh METU SIS offerings

```powershell
python -m pip install -r scraper/requirements.txt

# Every METU SIS program
npm run fetch-all

# Engineering only: AEE, CE, CENG, EE, IE, ME, ROB
npm run fetch-engineering
```

You can equivalently pass `--all` or `--engineering` to `npm run fetch-offerings` (for example, `npm run fetch-offerings -- --engineering`).

Each run compares the fresh data against the previously committed file and, when
anything changed, appends a per-department summary of added, removed, and changed
courses to [CHANGELOG.md](CHANGELOG.md). The JSON files are pretty-printed with
naturally sorted keys, so git diffs show exactly which courses changed. The
scheduled GitHub Actions run also uses the same summary as its commit message.

## Credits

- **UI Architecture:** Adapted from [Bilkent Scheduler](https://github.com/furkankose/bilkent-scheduler) by Furkan Kose, licensed under MIT. 
- **SIS Scraper Approach:** Based on the engine from [robotdegilim.xyz-backend](https://github.com/3alkan/robotdegilim.xyz-backend) by 3alkan, and [robotdegilim.xyz](https://github.com/erenerisken/robotdegilim.xyz) by erenerisken licensed under GPL-3.0.

## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**. See the [LICENSE](LICENSE) file in the root directory for the full license text and third-party notices.