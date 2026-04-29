# Contributing to Picture-Based Attendance

First off, thank you for considering contributing to the Picture-Based Attendance system! It's people like you that make the open source community such a fantastic place to learn, inspire, and create.

## 🚀 Setup Instructions

1. **Fork & Clone**
   Fork the repository on GitHub and clone your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/picture-based-attendance.git
   cd picture-based-attendance
   ```

2. **Environment Setup**
   Copy the example environment file and fill in your values:
   ```bash
   cp .env.example .env
   # Edit .env with your specific local or dev keys
   ```

3. **Install Dependencies**
   We have provided a unified setup script to get you up and running quickly:
   ```bash
   ./scripts/setup.sh
   ```
   *Alternatively, you can manually install dependencies in `frontend`, `backend`, and `ai-service`.*

## 🌿 Branching Strategy

- **`main`**: The stable branch. All releases come from here.
- **`dev`**: The active development branch. All PRs should target `dev`.
- **Feature Branches**: Use descriptive names like `feature/add-dark-mode` or `fix/auth-token-refresh`.

## ✍️ Commit Format

We follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation only changes
- `style:` Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- `refactor:` A code change that neither fixes a bug nor adds a feature
- `test:` Adding missing tests or correcting existing tests
- `chore:` Changes to the build process or auxiliary tools and libraries

## 🔀 Pull Request Process

1. Ensure your code passes all linting (`npm run lint` / `flake8`) and tests.
2. Update the README.md with details of changes to the interface, if applicable.
3. Submit a Pull Request targeting the `dev` branch.
4. Ensure your PR description clearly describes the problem and solution.

## 📜 Developer Certificate of Origin (DCO)

To ensure that all contributions are legally cleared for inclusion in the project, we require that all commits be signed off using the Developer Certificate of Origin. 

Add a `Signed-off-by` line to your commit messages. You can easily do this by using the `-s` flag with `git commit`:
```bash
git commit -s -m "feat: your feature here"
```
By signing off, you assert that you have the right to submit the contribution under the AGPLv3 license.

## 🎨 Code Standards

- **JavaScript/TypeScript**: Prettier + ESLint
- **Python**: Black + Flake8
- Ensure components are well-documented.
- Write tests for any new critical business logic.
