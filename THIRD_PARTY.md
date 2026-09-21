# Licensing and attribution

## Application

Sound & Sip original application code, documentation and generated test audio: Copyright (c) 2026 Sound & Sip contributors. Licensed under **AGPL-3.0-only**, see [LICENSE](LICENSE). Distributed WITHOUT ANY WARRANTY. Third-party files retain their own licenses; the application license does not relicense model weights.

Source and installation instructions: https://github.com/toshinoritakata/music-cocktail . Forks and modified network deployments must offer their own corresponding source as required by AGPL, rather than pointing only to this unmodified repository.

## Libraries

- TensorFlow.js / WASM backend 4.22.0: Google, Apache-2.0 (tfjs-layers also declares MIT). Source: https://github.com/tensorflow/tfjs/tree/tfjs-v4.22.0 . Copyright and license notices are retained in the npm packages and supplied builds.
- Essentia.js 0.1.3: Music Technology Group, Universitat Pompeu Fabra; AGPL-3.0. Unmodified npm dependency, not committed to this repository. The npm registry identifies release source commit `f46c91c08bdf263d5f3d575ab8fb0f9b81695acf`: https://github.com/MTG/essentia.js/tree/f46c91c08bdf263d5f3d575ab8fb0f9b81695acf . This source includes build instructions/scripts and references to Essentia and its dependencies. Retain the package's LICENSE and AUTHORS notices. If distributing compiled libraries separately, provide the complete corresponding source for the actual build and all applicable dependency notices.
- [Complete locked npm license inventory](docs/dependency-licenses.md). Transitive package licenses include MIT, ISC, BSD-2-Clause, BSD-3-Clause and Apache-2.0. Do not strip their notices when redistributing dependencies.

## MSD MusiCNN model — separate noncommercial terms

MSD MusiCNN v1, author Pablo Alonso, Music Technology Group, Universitat Pompeu Fabra. Upstream copyright notice: Universitat Pompeu Fabra 2019–2021. MusiCNN architecture/code credits include Jordi Pons and MTG (ISC notice preserved in the upstream LICENSE).

The graph and weights in `public/models/musicnn/` are unmodified files extracted from the official TensorFlow.js archive. They have not been retrained, quantized, or converted by this project. Metadata and original notices are retained. This independent project is not endorsed by MTG/UPF.

- [Original archive](https://essentia.upf.edu/models/autotagging/msd/msd-musicnn-1-tfjs.zip)
- [Original metadata and paper citation](https://essentia.upf.edu/models/autotagging/msd/msd-musicnn-1.json)
- [Preserved upstream LICENSE](public/models/musicnn/LICENSE)
- [Preserved upstream README](public/models/musicnn/UPSTREAM-README.md)
- [Upstream licensing information](https://essentia.upf.edu/licensing_information.html)

**Upstream notices are inconsistent:** the models README and legal-code link within LICENSE state [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/); the LICENSE heading and licensing-information page state [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). We preserve these notices verbatim and do not resolve the discrepancy by choosing the more permissive interpretation. Both permit attributed, unmodified, noncommercial redistribution, which is the scope of inclusion here. This is not a dual-license grant by this project. Consult MTG before commercial use or distributing modified weights. No extra restrictions are imposed on rights granted by upstream.

CLMR and MERT code/weights, third-party songs, album artwork and recordings are not included. The WAV examples are synthesized by the included `samples/generate.py`, without sampled recordings.
