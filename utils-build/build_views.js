const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../www/index.template.html');
const outputPath = path.join(__dirname, '../www/index.html');
const viewsDir = path.join(__dirname, '../www/views');

try {
    let template = fs.readFileSync(templatePath, 'utf8');

    const regex = /<!-- include views\/([^.]+)\.html -->/g;

    template = template.replace(regex, (match, tabId) => {
        const viewPath = path.join(viewsDir, `${tabId}.html`);
        if (!fs.existsSync(viewPath)) {
            throw new Error(`View file not found: ${viewPath}`);
        }
        return fs.readFileSync(viewPath, 'utf8');
    });

    fs.writeFileSync(outputPath, template, 'utf8');
    console.log('Successfully built www/index.html from template and views!');
} catch (err) {
    console.error('Error building index.html:', err);
    process.exit(1);
}
