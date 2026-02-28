# Issues-as-Code

Issues-as-Code means tasks are stored as version-controlled Markdown files inside the repository.
No external tracker. No parallel universe. If it's not in Git, it doesn't exist.

Issues live next to the code and follow the same lifecycle: create → review → implement → close.

---

# Repository Structure

All tasks are stored in:

```
docs/tasks/
```

Structure:

```
docs/tasks/
  README.md
  todo/
  done/
```

* `todo/` — active tasks and backlog
* `done/` — completed tasks

Tasks are never deleted. They are moved between folders using `git mv`.

---

# What a Task Contains

Each task is a Markdown file with:

* Metadata (ID, Title, Complexity)
* Problem description
* Scope (in/out)
* Technical overview
* Requirements
* Acceptance criteria

When completed, add:

```
## Implementation Notes
```

Include modified files and commit reference.

# Creating a Task

1. Create a file in:

```
docs/tasks/todo/
```

Example:

```
feature.<title>.md
bug.<title>.md
```

2. Commit it:

```bash
git add docs/tasks/todo/feature.<title>.md
git commit -m "Create task: <Title>"
```

All related commits must reference the task ID or title.

# Finding & Reviewing Tasks

List open tasks:

```bash
ls docs/tasks/todo
```

Search by title:

```bash
rg Title docs/tasks/todo
```

Search everything:

```bash
rg "keyword" docs/tasks
```

Review history:

```bash
git log docs/tasks/todo/<file>.md
```

# Closing a Task

1. Ensure acceptance criteria are met.
2. Add `## Implementation Notes`.
3. Move the file:

```bash
git mv docs/tasks/todo/<file>.md docs/tasks/done/<file>.md
git commit -m "Close task: <Title>"
```

# Reopening

If a bug appears:

```bash
git mv docs/tasks/done/<file>.md docs/tasks/todo/<file>.md
```

Add a `## Reopening Reason` section and commit.
