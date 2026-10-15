# docs/architecture

The views of this repository, kept short enough to stay true. Mermaid in Markdown, never an
exported image: a diagram that cannot be read as text in a pull request diff is a diagram whose
change nobody reviewed.

| File | Question it answers | Class |
|---|---|---|
| [surfaces.md](surfaces.md) | Who uses which surface, and with what authority? | authored |
| [layers.md](layers.md) | What may import what, and where does data enter? | authored |
| [view-state.md](view-state.md) | What may a view render, and what may it never render? | authored |

The system-wide views live in `rightone-api/docs/architecture` beside the decisions that bind
them - container view, trust boundaries, deployment topology, repository topology. This directory
holds only what is true of this repository.
