# Feature record for substantial frontend work

Use one short record per feature when decisions must survive across sessions or agents. For a small fix, the same fields may stay in working notes. Each stage updates its section from observed evidence; do not prefill later stages as completed.

## Scout

Request and current branch/status; docs/source/tests inspected; current behavior and data flow; affected files; baseline checks with results; confirmed contracts; dependencies, risks, and unknowns.

## BA

User problem and goal; actors and permissions; normal/alternate/failure journeys; loading, empty, error, success, disabled states; responsive and accessibility conditions; confirmed requirements versus assumptions; observable acceptance criteria; open decisions.

## Analyze

Viable approaches; selected approach and why; alternatives and trade-offs; performance, security, accessibility, maintenance and regression effects; backend/data/infrastructure handoffs.

## Plan

Files/modules; ordered tasks; data/state/API changes; chosen specialist skill paths; each acceptance criterion mapped to a check; rollback or compatibility concern; scope boundary.

## Cook

Changed files and behavior; skill procedures used; tests added or changed; mocks or limitations; deviations that caused a return to an earlier stage.

## Test

Executed commands and exit results; observed UI/API/a11y/responsive checks; acceptance criteria marked pass/fail/blocked individually; diff review; residual risks; prioritized next action and owner.
