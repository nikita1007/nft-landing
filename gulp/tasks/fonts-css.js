const fs = require("fs");
const fontscan = require("fontscan");

class cssFonts {
  /**
   * This variable contains all the font settings in `fonts_dir`, sorted by object.
   */
  fonts = [];

  constructor({ fonts_dir, path_to_fontcss_src_file }, ...other) {
    this.fonts_dir = fonts_dir;
    this.path_to_fontcss_src_file = path_to_fontcss_src_file;
    this.other_params = other[0];
    if (this.other_params.path_to_mixins_src_file) {
      this.path_to_mixins_src_file = this.other_params.path_to_mixins_src_file;
    }
  }

  async getFontsDirs() {
    return new Promise(async (resolve, reject) => {
      try {
        let dir = await fs.promises.readdir(this.fonts_dir);
        resolve(dir);
      } catch (error) {
        reject(error);
      }
    });
  }

  async checkMixinsCssFileExists() {
    const mixin_def_str = `@mixin font-face($name, $file, $weight: 400, $style: normal) {@font-face {font-family: "#{$name}";src: local("#{$file}"), url("../fonts/#{$file}.woff2") format("woff2"),url("../fonts/#{$file}.woff") format("woff");font-weight: $weight;font-style: $style;font-display: swap;}}\n`;

    if (this.path_to_mixins_src_file) {
      await fs.promises
        .readFile(this.path_to_mixins_src_file, "utf8")
        .then(async (data) => {
          if (data.match("@mixin font-face").index < 0) {
            const modifiedContent = mixin_def_str + data;

            // Write the content change back to the file
            await fs.promises.writeFile(
              this.path_to_mixins_src_file,
              modifiedContent
            );

            return true;
          }
        })
        .catch((err) => {
          // Create a font style file if it doesn't exist
          fs.writeFile(this.path_to_mixins_src_file, mixin_def_str, (err) => {
            if (err) throw err;

            console.log(`
  ----------------------------------------------------------------------------------
  • The file '${this.path_to_mixins_src_file}' was succesfully created!
  ----------------------------------------------------------------------------------
        `);
          });

          return true;
        });
    } else {
      console.error(`
      Font style file not defined!
      Please read the documentation at the link: https://github.com/nikita1007/gulp_v3.0 in the "Working with Fonts" section
      `);
      return false;
    }
  }

  async checkFontsCssFileExists() {
    if (this.path_to_fontcss_src_file) {
      // Checking for the existence of a file with included fonts in styles
      await fs.promises
        .readFile(this.path_to_fontcss_src_file, "utf8")
        .then(async (data) => {
          if (data && data.match("@import 'mixins';").index != 0) {
            // If the lines "@import 'mixins';" is not in the file, then add the line to the beginning of the file content
            const modifiedContent = `@import 'mixins';\n` + data;

            // Write the content change back to the file
            await fs.promises.writeFile(
              this.path_to_fontcss_src_file,
              modifiedContent
            );
          }
          return true;
        })
        .catch((err) => {
          // Create a font style file if it doesn't exist
          fs.writeFile(
            this.path_to_fontcss_src_file,
            `@import 'mixins';`,
            (err) => {
              if (err) throw err;

              console.log(`
  ----------------------------------------------------------------------------------
  • The file '${this.path_to_fontcss_src_file}' was succesfully created!
  ----------------------------------------------------------------------------------
        `);
            }
          );

          return true;
        });
    } else {
      console.error(`
      Font style file not defined!
      Please read the documentation at the link: https://github.com/nikita1007/gulp_v3.0 in the "Working with Fonts" section
      `);
      return false;
    }
  }

  cssFontConfStr(font_family, postscriptName, weight, style) {
    return `"${font_family}", "${font_family}/${postscriptName}" ${weight}, "${style}"`;
  }

  async readCssFontsFile() {
    const font_style_file_data = await fs.promises
      .readFile(this.path_to_fontcss_src_file, "utf8")
      .then((data) => data);

    return font_style_file_data;
  }

  async fontsIteration() {
    const fonts = await this.getFontsDirs()
      .then((dir_fonts) => dir_fonts)
      .catch((error) => console.error(error));

    try {
      await this.checkMixinsCssFileExists();
      await this.checkFontsCssFileExists();
    } catch (error) {
      console.error(error);
    }

    const font_style_file_data = await this.readCssFontsFile();
    const font_style_file_data_split = font_style_file_data
      .replace(/[\r]/g, "")
      .split(/[\n]/g);

    const font_import_label = (css_font_conf_str) =>
      `@include font-face(${css_font_conf_str});`;

    for (const font_family of fonts) {
      const font_obj = new Object();

      const font_conf = await fontscan.getDirectoryFonts(
        `${this.fonts_dir}/${font_family}/`
      );

      const font_elems = new Array();

      for (const font_el of font_conf) {
        const font_el_object = new Object();

        font_el_object.postscript_name = font_el.postscriptName;
        font_el_object.weight = font_el.weight;
        font_el_object.style = font_el.italic ? "italic" : "normal";

        if (
          font_style_file_data_split.indexOf(
            font_import_label(
              this.cssFontConfStr(
                font_family,
                font_el_object.postscript_name,
                font_el_object.weight,
                font_el_object.style
              )
            )
          ) == -1
        ) {
          font_el_object.is_ready_exist = false;
        } else {
          font_el_object.is_ready_exist = true;
        }

        font_elems.push(font_el_object);
      }

      font_obj.font_family = font_family;
      font_obj.fonts = font_elems;

      this.fonts.push(font_obj);
    }
  }

  async addFonts() {
    const font_import_label = (css_font_conf_str) =>
      `@include font-face(${css_font_conf_str});`;

    await this.fontsIteration();

    for (const font_obj of this.fonts) {
      for (const font of font_obj.fonts) {
        if (!font.is_ready_exist) {
          const modifiedContent =
            (await this.readCssFontsFile()) +
            "\n" +
            font_import_label(
              this.cssFontConfStr(
                font_obj.font_family,
                font.postscript_name,
                font.weight,
                font.style
              )
            );
          // Write the content change back to the file
          fs.writeFileSync(this.path_to_fontcss_src_file, modifiedContent);
        }
      }
    }

  }
}

module.exports = { cssFonts };
