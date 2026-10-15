# ops

Files a pipeline reads and a person decides.

| File | Read by | Holds |
|---|---|---|
| `sca-baseline.txt` | the dependency gate of the Jenkins build (`Jenkinsfile.harbor`, `sca`) | how many critical, high, moderate and low advisories the workspace had when the line was last agreed |

The gate blocks a build when critical or high goes above its line. Lowering a number needs no
discussion. Raising one is a risk acceptance: the pull request says which advisory, why it is
acceptable, and until when.
