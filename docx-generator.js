// docx-generator.js - Pure JS Native OpenXML (.docx) Generator with Embedded PNG Screenshots & Affected Components

(function (global) {
  const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function stringToUtf8Bytes(str) {
    return new TextEncoder().encode(str);
  }

  function base64ToBytes(dataUrl) {
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const binStr = atob(base64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
  }

  function getPngDimensions(bytes) {
    if (
      bytes.length >= 24 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const width = view.getUint32(16, false);
      const height = view.getUint32(20, false);
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }
    return { width: 1280, height: 720 };
  }

  function createZipArchive(files) {
    let offset = 0;
    const localParts = [];
    const centralParts = [];

    const now = new Date();
    const dosTime =
      ((now.getHours() & 0x1f) << 11) |
      ((now.getMinutes() & 0x3f) << 5) |
      ((now.getSeconds() >> 1) & 0x1f);
    const dosDate =
      (((now.getFullYear() - 1980) & 0x7f) << 9) |
      (((now.getMonth() + 1) & 0x0f) << 5) |
      (now.getDate() & 0x1f);

    for (const file of files) {
      const nameBytes = stringToUtf8Bytes(file.name);
      const dataBytes = file.data instanceof Uint8Array ? file.data : stringToUtf8Bytes(file.data);
      const crc = crc32(dataBytes);
      const size = dataBytes.length;

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(localHeader.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true);
      lv.setUint32(22, size, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      localParts.push(localHeader, dataBytes);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(centralHeader.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      centralHeader.set(nameBytes, 46);

      centralParts.push(centralHeader);
      offset += localHeader.length + size;
    }

    const centralDirOffset = offset;
    let centralDirSize = 0;
    for (const c of centralParts) centralDirSize += c.length;

    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralDirSize, true);
    ev.setUint32(16, centralDirOffset, true);
    ev.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, eocd], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  }

  function escapeXml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generates a complete .docx Blob from steps, affectedComponents, and metadata
   */
  function generateVeevaDocx(docSteps, metadata = {}, affectedComponents = []) {
    const zipFiles = [];
    const rels = [
      {
        id: 'rIdStyles',
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
        target: 'styles.xml'
      }
    ];

    let imageCounter = 0;
    const bodyParagraphsXml = [];

    const docTitle = metadata.title || 'Veeva Vault RIM Configuration Documentation';
    const includeHeader = metadata.includeHeader !== false;

    if (includeHeader) {
      bodyParagraphsXml.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:before="0" w:after="100"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:color w:val="2B3643"/>
              <w:sz w:val="30"/>
            </w:rPr>
            <w:t>${escapeXml(docTitle)}</w:t>
          </w:r>
        </w:p>
      `);

      // Build structured Header Summary Table (Cycle Name, Requester, Developer, Ticket/Env/Date)
      bodyParagraphsXml.push(buildHeaderMetaTableXml(metadata));

      // Render Original Request text box if provided
      if (metadata.originalRequest && metadata.originalRequest.trim()) {
        bodyParagraphsXml.push(`
          <w:p>
            <w:pPr>
              <w:spacing w:before="180" w:after="60"/>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:b/>
                <w:color w:val="2B3643"/>
                <w:sz w:val="22"/>
              </w:rPr>
              <w:t>Original Request:</w:t>
            </w:r>
          </w:p>
        `);

        const reqLines = metadata.originalRequest.trim().split(/\r?\n/);
        const reqParasXml = reqLines
          .map(
            (rLine, idx) => `
            <w:p>
              <w:pPr>
                <w:spacing w:before="20" w:after="${idx === reqLines.length - 1 ? '40' : '40'}" w:line="260" w:lineRule="auto"/>
              </w:pPr>
              <w:r>
                <w:rPr><w:sz w:val="21"/><w:color w:val="1E293B"/></w:rPr>
                <w:t xml:space="preserve">${escapeXml(rLine)}</w:t>
              </w:r>
            </w:p>`
          )
          .join('');

        bodyParagraphsXml.push(`
          <w:tbl>
            <w:tblPr>
              <w:tblW w:w="5000" w:type="pct"/>
              <w:tblBorders>
                <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                <w:left w:val="single" w:sz="18" w:space="0" w:color="F7941D"/>
                <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
              </w:tblBorders>
            </w:tblPr>
            <w:tr>
              <w:tc>
                <w:tcPr>
                  <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
                  <w:tcMar>
                    <w:top w:w="100" w:type="dxa"/>
                    <w:bottom w:w="100" w:type="dxa"/>
                    <w:left w:w="160" w:type="dxa"/>
                    <w:right w:w="160" w:type="dxa"/>
                  </w:tcMar>
                </w:tcPr>
                ${reqParasXml}
              </w:tc>
            </w:tr>
          </w:tbl>
        `);
      }

      // Section divider before Configuration Steps
      bodyParagraphsXml.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:before="200" w:after="120"/>
            <w:pBdr>
              <w:bottom w:val="single" w:sz="6" w:space="6" w:color="CBD5E1"/>
            </w:pBdr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:color w:val="2B3643"/>
              <w:sz w:val="22"/>
            </w:rPr>
            <w:t>Configuration Steps:</w:t>
          </w:r>
        </w:p>
      `);
    }

    // 1. Render Configuration Steps & Screenshots
    docSteps.forEach((step) => {
      if (step.type === 'text' && step.text) {
        const lines = step.text.split(/\r?\n/);
        lines.forEach((line, lineIdx) => {
          const isBlankLine = line.trim().length === 0;
          if (isBlankLine) {
            bodyParagraphsXml.push(
              `<w:p><w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr></w:p>`
            );
            return;
          }

          const isSubItem = /^\s*>\s+/.test(line);
          const indentXml = isSubItem ? `<w:ind w:left="480"/>` : '';
          const spacingAfter = lineIdx === lines.length - 1 ? '160' : '60';

          bodyParagraphsXml.push(`
            <w:p>
              <w:pPr>
                ${indentXml}
                <w:spacing w:before="40" w:after="${spacingAfter}" w:line="276" w:lineRule="auto"/>
              </w:pPr>
              <w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>
            </w:p>
          `);
        });
      } else if (step.type === 'image' && step.imageDataUrl) {
        imageCounter++;
        const rId = `rIdImg${imageCounter}`;
        const fileName = `image${imageCounter}.png`;
        const imgBytes = base64ToBytes(step.imageDataUrl);
        const dims = getPngDimensions(imgBytes);

        zipFiles.push({
          name: `word/media/${fileName}`,
          data: imgBytes
        });

        rels.push({
          id: rId,
          type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
          target: `media/${fileName}`
        });

        const MAX_WIDTH_EMU = 5669280;
        const MAX_HEIGHT_EMU = 6858000;
        let cx = dims.width * 9525;
        let cy = dims.height * 9525;
        if (cx > MAX_WIDTH_EMU) {
          const ratio = MAX_WIDTH_EMU / cx;
          cx = Math.round(cx * ratio);
          cy = Math.round(cy * ratio);
        }
        if (cy > MAX_HEIGHT_EMU) {
          const ratio = MAX_HEIGHT_EMU / cy;
          cx = Math.round(cx * ratio);
          cy = Math.round(cy * ratio);
        }

        bodyParagraphsXml.push(`
          <w:p>
            <w:pPr>
              <w:spacing w:before="100" w:after="220"/>
            </w:pPr>
            <w:r>
              <w:drawing>
                <wp:inline distT="0" distB="0" distL="0" distR="0">
                  <wp:extent cx="${cx}" cy="${cy}"/>
                  <wp:effectExtent l="0" t="0" r="0" b="0"/>
                  <wp:docPr id="${imageCounter}" name="Picture ${imageCounter}"/>
                  <wp:cNvGraphicFramePr>
                    <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
                  </wp:cNvGraphicFramePr>
                  <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                      <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                        <pic:nvPicPr>
                          <pic:cNvPr id="${imageCounter}" name="${fileName}"/>
                          <pic:cNvPicPr/>
                        </pic:nvPicPr>
                        <pic:blipFill>
                          <a:blip r:embed="${rId}"/>
                          <a:stretch>
                            <a:fillRect/>
                          </a:stretch>
                        </pic:blipFill>
                        <pic:spPr>
                          <a:xfrm>
                            <a:off x="0" y="0"/>
                            <a:ext cx="${cx}" cy="${cy}"/>
                          </a:xfrm>
                          <a:prstGeom prst="rect">
                            <a:avLst/>
                          </a:prstGeom>
                          <a:ln w="9525">
                            <a:solidFill>
                              <a:srgbClr val="CBD5E1"/>
                            </a:solidFill>
                          </a:ln>
                        </pic:spPr>
                      </pic:pic>
                    </a:graphicData>
                  </a:graphic>
                </wp:inline>
              </w:drawing>
            </w:r>
          </w:p>
        `);

        if (step.caption && step.caption.trim()) {
          bodyParagraphsXml.push(`
            <w:p>
              <w:pPr>
                <w:spacing w:before="0" w:after="200"/>
              </w:pPr>
              <w:r>
                <w:rPr>
                  <w:i/>
                  <w:color w:val="64748B"/>
                  <w:sz w:val="18"/>
                </w:rPr>
                <w:t>${escapeXml(step.caption.trim())}</w:t>
              </w:r>
            </w:p>
          `);
        }
      }
    });

    // 2. Append Affected Components ("Components  :") at the end of the Word document
    if (
      metadata.appendComponents !== false &&
      Array.isArray(affectedComponents) &&
      affectedComponents.length > 0
    ) {
      const compFormat = metadata.componentsFormat || 'text'; // 'text', 'table', or 'both'

      // Heading: "Components  :"
      bodyParagraphsXml.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:before="320" w:after="120"/>
            <w:pBdr>
              <w:top w:val="single" w:sz="6" w:space="8" w:color="CBD5E1"/>
            </w:pBdr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:sz w:val="24"/>
            </w:rPr>
            <w:t xml:space="preserve">Components  :</w:t>
          </w:r>
        </w:p>
      `);

      // Format A: Exact multi-line text blocks requested by user:
      // Name: ...
      // Component Name: ...
      // Component Type : ...
      //  Modified Date : ...
      if (compFormat === 'text' || compFormat === 'both') {
        affectedComponents.forEach((comp) => {
          const lines = [
            `Name: ${comp.name || ''}`,
            `Component Name: ${comp.componentName || ''}`,
            `Component Type : ${comp.componentType || ''}`,
            ` Modified Date : ${comp.modifiedDate || ''}`
          ];

          lines.forEach((l, i) => {
            const afterSpace = i === lines.length - 1 ? '200' : '20';
            bodyParagraphsXml.push(`
              <w:p>
                <w:pPr>
                  <w:spacing w:before="0" w:after="${afterSpace}" w:line="250" w:lineRule="auto"/>
                </w:pPr>
                <w:r><w:t xml:space="preserve">${escapeXml(l)}</w:t></w:r>
              </w:p>
            `);
          });
        });
      }

      // Format B: Clean Word Summary Table of Affected Components (if 'table' or 'both')
      if (compFormat === 'table' || compFormat === 'both') {
        bodyParagraphsXml.push(buildComponentsWordTableXml(affectedComponents));
      }
    }

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

    const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels.map((r) => `  <Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`).join('\n')}
</Relationships>`;

    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="1E293B"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`;

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${bodyParagraphsXml.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

    zipFiles.push(
      { name: '[Content_Types].xml', data: contentTypesXml },
      { name: '_rels/.rels', data: rootRelsXml },
      { name: 'word/_rels/document.xml.rels', data: docRelsXml },
      { name: 'word/styles.xml', data: stylesXml },
      { name: 'word/document.xml', data: documentXml }
    );

    return createZipArchive(zipFiles);
  }

  function buildHeaderMetaTableXml(metadata) {
    const rows = [
      { label: 'Cycle / Release:', value: metadata.cycleName || '-' },
      { label: 'Requester:', value: metadata.requesterName || '-' },
      { label: 'Developer:', value: metadata.developerName || metadata.userName || '-' }
    ];

    const extraParts = [];
    if (metadata.ticketId) extraParts.push(`Ticket: ${metadata.ticketId}`);
    if (metadata.environment) extraParts.push(`Env: ${metadata.environment}`);
    if (metadata.vaultDns) extraParts.push(`Vault: ${metadata.vaultDns}`);
    extraParts.push(`Date: ${new Date().toLocaleString()}`);

    rows.push({
      label: 'Environment / Date:',
      value: extraParts.join('  |  ')
    });

    const rowsXml = rows
      .map(
        (r) => `
      <w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1600" w:type="pct"/>
            <w:shd w:val="clear" w:color="auto" w:fill="EAECED"/>
            <w:tcMar>
              <w:top w:w="60" w:type="dxa"/>
              <w:bottom w:w="60" w:type="dxa"/>
              <w:left w:w="120" w:type="dxa"/>
              <w:right w:w="120" w:type="dxa"/>
            </w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="2B3643"/><w:sz w:val="19"/></w:rPr>
              <w:t>${escapeXml(r.label)}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="3400" w:type="pct"/>
            <w:tcMar>
              <w:top w:w="60" w:type="dxa"/>
              <w:bottom w:w="60" w:type="dxa"/>
              <w:left w:w="120" w:type="dxa"/>
              <w:right w:w="120" w:type="dxa"/>
            </w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:color w:val="1E293B"/><w:sz w:val="19"/></w:rPr>
              <w:t>${escapeXml(r.value)}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>`
      )
      .join('');

    return `
      <w:tbl>
        <w:tblPr>
          <w:tblW w:w="5000" w:type="pct"/>
          <w:tblBorders>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="F7941D"/>
            <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
            <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          </w:tblBorders>
        </w:tblPr>
        ${rowsXml}
      </w:tbl>
    `;
  }

  function buildComponentsWordTableXml(components) {
    const headerRow = `
      <w:tr>
        ${['Name', 'Component Name', 'Component Type', 'Modified Date']
          .map(
            (h) => `
          <w:tc>
            <w:tcPr>
              <w:shd w:val="clear" w:color="auto" w:fill="1E293B"/>
            </w:tcPr>
            <w:p>
              <w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
              <w:r>
                <w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="19"/></w:rPr>
                <w:t>${escapeXml(h)}</w:t>
              </w:r>
            </w:p>
          </w:tc>`
          )
          .join('')}
      </w:tr>
    `;

    const dataRows = components
      .map(
        (c) => `
      <w:tr>
        <w:tc><w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/></w:rPr><w:t>${escapeXml(c.name)}</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/></w:rPr><w:t>${escapeXml(c.componentName)}</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/></w:rPr><w:t>${escapeXml(c.componentType)}</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>${escapeXml(c.modifiedDate)}</w:t></w:r></w:p></w:tc>
      </w:tr>`
      )
      .join('');

    return `
      <w:tbl>
        <w:tblPr>
          <w:tblW w:w="5000" w:type="pct"/>
          <w:tblBorders>
            <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
            <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          </w:tblBorders>
        </w:tblPr>
        ${headerRow}
        ${dataRows}
      </w:tbl>
    `;
  }

  global.VeevaDocxGenerator = {
    generateVeevaDocx
  };
})(window);
