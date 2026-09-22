# Personal Knowledge Map — Project Context

## 1. Project Overview

**Project name:** Personal Knowledge Map

**Project type:** Frontend-heavy web application with a lightweight backend.

The Personal Knowledge Map is an interactive system that represents a user's knowledge as a connected graph of concepts instead of treating learning material as isolated notes.

The central idea is:

> Notes store information, while a knowledge map shows how pieces of knowledge are connected, what the user already knows, where gaps exist, and what should logically be learned next.

The project is primarily designed as a college project where visual quality, clear functionality, meaningful real-world use, and a polished demonstration are important. The implementation should remain relatively simple and avoid unnecessary technical complexity.

---

## 2. Problem Being Solved

Students commonly organize learning material as separate notes, bookmarks, PDFs, videos, and resources.

This makes it difficult to understand:

- How concepts are connected.
- Which concepts are prerequisites for others.
- Which concepts have already been learned.
- Which concepts still need to be learned.
- Where the user's knowledge gaps are.
- What should logically be learned next.
- Which resources belong to a particular concept.
- How knowledge in one subject connects to another concept.

A normal notes application mainly represents:

`Topic -> Content`

The Personal Knowledge Map represents:

`Concept -> Relationships -> Prerequisites -> Learning State -> Knowledge Gaps -> Learning Path`

The project therefore focuses on the **structure and relationships of knowledge**, rather than simply storing notes.

---

## 3. Core Concept

The application models knowledge using three fundamental elements:

### Concepts

A concept is an individual unit of knowledge.

Examples:

- Machine Learning
- Neural Networks
- Probability
- Linear Algebra
- Operating Systems
- Process Scheduling
- Database Indexing

A concept can contain information such as:

- Name
- Description
- Category
- Difficulty
- Learning status
- Confidence level
- Associated resources

### Relationships

Relationships describe how concepts are connected.

Possible relationship types include:

- Prerequisite
- Related to
- Part of
- Leads to
- Depends on

For example:

`Linear Algebra -> prerequisite -> Neural Networks`

or:

`Process -> related to -> Thread`

The graph should represent meaningful knowledge relationships rather than arbitrary connections.

### Learning State

Each concept has a learning state that represents the user's progress.

A simple progression is:

`Not Started -> Learning -> Learned -> Mastered`

A confidence value can also be associated with a concept, representing how confident the user feels about their understanding.

---

## 4. Main Project Flow

The overall user flow is:

`Enter Application`
-> `View Knowledge Map`
-> `Explore Concepts`
-> `Inspect Concept Information`
-> `Create/Edit Concepts`
-> `Connect Concepts`
-> `Update Learning Status and Confidence`
-> `Identify Knowledge Gaps`
-> `Generate/Follow Learning Paths`
-> `Track Overall Knowledge Progress`

The application should feel like a continuous knowledge-management system rather than a collection of unrelated features.

---

## 5. Creating and Managing Knowledge

The user should be able to create concepts and define their properties.

For each concept, the user can specify information such as:

- Concept name
- Description
- Subject/category
- Difficulty
- Current learning status
- Confidence
- Related resources

Existing concepts should be editable and removable.

The user should also be able to establish relationships between concepts and specify what kind of relationship exists.

For example:

`Probability -> prerequisite -> Machine Learning`

This allows the system to understand the structure of the user's knowledge.

---

## 6. Knowledge Graph

The knowledge graph is the central representation of the project.

Each concept is represented as a node and each relationship as an edge.

For example:

`Linear Algebra`
-> `Probability`
-> `Machine Learning`
-> `Neural Networks`
-> `CNN`

The graph allows the user to visually understand how concepts depend on and relate to one another.

The graph should support normal exploration operations such as:

- Selecting concepts
- Moving around the graph
- Zooming
- Searching
- Filtering
- Creating relationships
- Inspecting concept information

The exact visual design can change during implementation. The important requirement is that the graph remains the central representation of interconnected knowledge.

---

## 7. Concept Information

When a concept is selected, the system should make its relevant information available.

This can include:

- Description
- Category
- Difficulty
- Learning status
- Confidence
- Prerequisites
- Related concepts
- Dependent concepts
- Learning resources

The purpose is to allow the user to understand not only the concept itself, but also its position within the larger knowledge structure.

---

## 8. Learning Progress

The system tracks the user's progress through the knowledge graph.

Each concept can have:

- Learning status
- Confidence level

This allows the system to distinguish between:

- Concepts the user has not started.
- Concepts currently being studied.
- Concepts the user considers learned.
- Concepts the user considers mastered.

Confidence adds another dimension.

For example, a concept may be marked as learned but have only 40% confidence. This can indicate that the concept deserves additional review.

---

## 9. Knowledge Gap Detection

One of the main functional ideas is identifying knowledge gaps.

A knowledge gap can occur when a concept requires another concept as a prerequisite, but that prerequisite has not been sufficiently completed.

Example:

`Machine Learning`
-> requires `Probability`
-> requires `Statistics`

If the user tries to progress toward Machine Learning while Statistics is incomplete, the system can identify Statistics as a knowledge gap.

Knowledge gaps can also be identified when:

- A prerequisite has not been started.
- A prerequisite is still being learned.
- Confidence in a prerequisite is very low.
- A required concept is missing from the knowledge map.

This does not require advanced AI. The initial implementation can use straightforward graph and rule-based logic.

---

## 10. Learning Path

The knowledge graph can be used to determine a logical path toward a target concept.

Suppose the user wants to learn:

`CNN`

and the graph contains:

`Linear Algebra`
-> `Machine Learning`
-> `Neural Networks`
-> `CNN`

The system can use prerequisite relationships to construct a learning path.

The resulting path represents the concepts that should be understood before reaching the target.

The learning path should also reflect the user's current progress.

For example:

- Completed prerequisites can be marked as completed.
- Concepts currently being studied can be identified.
- Unstarted concepts can be shown as future steps.

The purpose is not to create a sophisticated AI tutor. It is to use the knowledge graph to make the user's existing learning structure actionable.

---

## 11. Recommended Next Concept

The system can identify a reasonable next learning target using simple rules.

For example:

If a concept:

- has its required prerequisites completed,
- has not yet been completed by the user,
- and is part of the user's knowledge graph,

then it can be considered a possible next learning target.

This can produce suggestions such as:

> Neural Networks is ready to be studied because its required prerequisites have been completed.

The recommendation logic should remain transparent and rule-based unless a more advanced system is deliberately added later.

---

## 12. Resources

Concepts can have learning resources associated with them.

Examples:

- Videos
- Articles
- Documentation
- Courses
- PDFs
- Books
- External websites

A resource should be associated with a specific concept so that the user can access relevant material while studying that concept.

The project does not need to automatically discover or scrape resources in the initial version.

---

## 13. Search and Filtering

As the knowledge graph grows, users should be able to find concepts efficiently.

Useful filtering dimensions include:

- Category
- Learning status
- Difficulty
- Knowledge gaps
- Mastered concepts
- Learning concepts
- Unstarted concepts

Search and filtering should operate on the user's existing knowledge graph.

---

## 14. Knowledge Analytics

The system can derive basic statistics from the knowledge graph.

Examples include:

- Total number of concepts
- Number of mastered concepts
- Number of learned concepts
- Number of concepts currently being studied
- Number of unstarted concepts
- Overall knowledge coverage
- Number of unresolved knowledge gaps
- Distribution of concepts by category
- Distribution by difficulty
- Average or overall confidence

These analytics should be calculated from the underlying concept data rather than requiring a complicated analytics backend.

---

## 15. Example Use Case

Consider a student learning Machine Learning.

Their knowledge graph might contain:

`Mathematics`
-> `Linear Algebra`
-> `Probability`
-> `Statistics`
-> `Machine Learning`
-> `Supervised Learning`
-> `Decision Trees`
-> `Random Forest`

The student marks:

- Linear Algebra: Mastered
- Probability: Learned
- Statistics: Learning
- Machine Learning: Not Started

The system can then identify:

1. Statistics is an incomplete prerequisite.
2. Machine Learning should not be treated as fully ready if Statistics is required.
3. The student has a knowledge gap around Statistics.
4. Once Statistics is completed, Machine Learning becomes a possible next learning target.
5. The user can follow the prerequisite chain toward later concepts such as Decision Trees and Random Forest.

This demonstrates the core value of the project: the system does not merely store topics; it understands the relationships between them.

---

## 16. Technical Scope

The project should intentionally remain lightweight.

A possible architecture is:

`Frontend`
-> `Graph and application logic`
-> `Lightweight backend/database`

The data model can be based primarily on:

### Concepts

Stores concept information such as:

- ID
- Name
- Description
- Category
- Difficulty
- Status
- Confidence

### Relationships

Stores:

- ID
- Source concept
- Target concept
- Relationship type

### Resources

Stores:

- ID
- Related concept
- Resource title
- Resource URL
- Resource type

This is sufficient for the core project.

---

## 17. Implementation Philosophy

The project is intended to achieve a strong result without unnecessary implementation effort.

Priorities:

1. Clear real-world problem.
2. Strong visual representation of the knowledge graph.
3. Smooth interaction.
4. Meaningful functionality.
5. Simple and reliable data model.
6. Easy-to-explain logic.
7. Polished demonstration.
8. Minimal unnecessary backend complexity.

Avoid adding complexity merely to make the project sound more advanced.

Features such as AI-generated knowledge graphs, LLM-based recommendations, automatic PDF understanding, web scraping, real-time collaboration, social networking, or complicated authentication are not required for the core project.

If advanced features are added later, they should provide a clear benefit and should not compromise reliability or implementation simplicity.

---

## 18. Project Identity

The project should consistently be understood as:

> **An interactive personal knowledge graph that helps users organize concepts, understand relationships and prerequisites, track learning progress, identify knowledge gaps, and discover logical learning paths.**

It is **not primarily**:

- A note-taking application.
- A task manager.
- A generic graph visualization tool.
- An AI chatbot.
- A course platform.
- A social learning platform.

The graph and the relationships between knowledge concepts are the central identity of the project.

---

## 19. Core Feature Set

The core version should contain:

1. Concept creation and management.
2. Interactive knowledge graph.
3. Relationship creation and management.
4. Learning status tracking.
5. Confidence tracking.
6. Concept search and filtering.
7. Resource association.
8. Knowledge-gap detection.
9. Prerequisite-based learning paths.
10. Next-concept suggestions.
11. Basic learning analytics.
12. Persistent storage.

These features together form the complete baseline project.

---

## 20. Expected Final Experience

A user should be able to enter the application with a collection of concepts and gradually turn them into a structured knowledge graph.

The application should help answer four core questions:

### What do I know?

Answered through concept status, confidence, and the graph.

### How is my knowledge connected?

Answered through relationships and prerequisites.

### What am I missing?

Answered through knowledge-gap detection.

### What should I learn next?

Answered through prerequisite-based learning paths and next-concept suggestions.

These four questions represent the main purpose of the entire project.

---

## 21. Future Extension Possibilities

If additional functionality is required later, possible extensions include:

- AI-assisted concept extraction.
- Importing concepts from documents.
- Automatic relationship suggestions.
- Spaced-repetition integration.
- Study-session tracking.
- More advanced learning recommendations.
- Import/export of knowledge graphs.
- Collaboration or shared knowledge maps.
- Integration with external learning platforms.

These are optional extensions and are not part of the minimum viable implementation.

---

## 22. Important Context for Future Agents

When continuing work on this project, preserve the following principles:

- The project is called **Personal Knowledge Map**.
- The central idea is an interactive graph of interconnected knowledge.
- The goal is to solve the problem of fragmented learning and lack of visibility into prerequisites, knowledge gaps, and learning paths.
- The project should be frontend-heavy and visually polished.
- Backend complexity should remain low.
- Logic should be simple, deterministic, and easy to explain.
- The project should prioritize reliability and demonstration quality over unnecessary technical complexity.
- Do not turn it into a generic notes application.
- Do not introduce AI merely for the sake of saying the project uses AI.
- The knowledge graph, relationships, learning state, knowledge gaps, and prerequisite-based learning paths are the core functionality.
- Specific UI layouts, page structures, component designs, colors, and visual styles are intentionally not fixed by this project context. They can be decided later based on implementation and design requirements.
