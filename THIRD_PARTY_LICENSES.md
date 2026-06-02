# Third-Party Licenses

Yappr incorporates and distributes the following third-party open-source
components. Each is licensed under the terms summarized below. Full license
text is reproduced where the license requires it.

Yappr itself is proprietary; see [LICENSE](LICENSE).

---

## Required attributions

### Built with Llama

The Llama 3 family of models is used (via Groq's hosted inference) for the
text-cleanup ("polish") step of Yappr's dictation pipeline.

> Built with Llama. Llama 3 is licensed under the Llama 3 Community License,
> Copyright © Meta Platforms, Inc. All Rights Reserved.

Full license: <https://www.llama.com/llama3_3/license/>

### Trademark notice

Slack, Gmail, iMessage, Notion, Cursor, ChatGPT, Claude, Groq, Llama, and
Whisper are trademarks or registered trademarks of their respective owners.
Yappr uses these names solely to identify the corresponding products and
services with which Yappr interoperates. Yappr is not affiliated with,
endorsed by, or sponsored by any of these companies.

---

## Production dependencies

| Component | Version | License |
| --- | --- | --- |
| react | 18.x | MIT |
| react-dom | 18.x | MIT |
| electron-store | 8.x | MIT |
| @electron-toolkit/utils | 4.x | MIT |
| @fugood/whisper.node | 1.x | MIT |
| @fugood/node-whisper-darwin-arm64 | 1.x | MIT |
| @fugood/node-whisper-darwin-x64 | 1.x | MIT |
| node-global-key-listener | 0.x | MIT |
| simple-icons | 16.x | CC0-1.0 |
| @ffmpeg-installer/ffmpeg | 1.x | LGPL-2.1 (ffmpeg binary; LGPL build) |
| groq-sdk | 0.x | Apache-2.0 |
| electron | 29.x | MIT (runtime, devDependency) |

Whisper model weights downloaded at runtime from
`huggingface.co/ggerganov/whisper.cpp` are derivative artifacts of OpenAI's
Whisper model, licensed under the MIT License. The whisper.cpp project itself
is also MIT-licensed.

---

## ffmpeg (LGPL-2.1) — source availability

Yappr incorporates an unmodified per-platform `ffmpeg` binary distributed
by the `@ffmpeg-installer/ffmpeg` npm package. The ffmpeg binary used is
built against the LGPL-2.1 license (without `--enable-gpl`), which permits
inclusion in proprietary applications subject to the LGPL's terms.

You may obtain the corresponding source code for the ffmpeg version included
in this distribution from:

- The ffmpeg project: <https://ffmpeg.org/download.html>
- The `@ffmpeg-installer/ffmpeg` package source:
  <https://github.com/kribblo/node-ffmpeg-installer>

The full text of the LGPL-2.1 is available at:
<https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html>

You may relink the LGPL-licensed ffmpeg binary in Yappr with a modified
version by replacing the binary file located at:

- macOS: `Yappr.app/Contents/Resources/app.asar.unpacked/node_modules/@ffmpeg-installer/darwin-{arm64,x64}/ffmpeg`
- Windows: `resources/app.asar.unpacked/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe`

provided the replacement binary preserves a compatible interface.

---

## Apache License 2.0 — required for groq-sdk

Yappr incorporates `groq-sdk`, which is licensed under the Apache
License, Version 2.0. The full license text follows:

```
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

Full license text: <https://www.apache.org/licenses/LICENSE-2.0>

---

## MIT License — template applicable to MIT-licensed components above

The MIT-licensed components listed in the dependency table are distributed
under the following terms (with the respective copyright holders' notices
preserved in their own source distributions):

```
Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

---

## CC0-1.0 — simple-icons

The `simple-icons` SVG outlines are dedicated to the public domain under
the Creative Commons CC0 1.0 Universal license. The underlying brand
trademarks remain the property of their respective owners; CC0 applies
only to the SVG file itself, not to the trademark.

Full deed: <https://creativecommons.org/publicdomain/zero/1.0/>

---

## Whisper model weights

Yappr downloads quantized Whisper model weights from
`huggingface.co/ggerganov/whisper.cpp` on demand when the user selects the
local provider. The original Whisper model weights were released by OpenAI
under the MIT License. The GGML quantized re-distributions on Hugging Face
travel under the same MIT terms.

---

## Updating this file

This file should be regenerated whenever a production dependency is added,
removed, or upgraded. The list above reflects production dependencies as of
the date in the file footer; for an authoritative current snapshot, run
`npx license-checker --production --summary`.

_Last reviewed: 2026-05-17._
