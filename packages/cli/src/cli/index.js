const createFileWithContent = require('./createFileWithContent');
const getSchema = require('./schema');
const getModule = require('./module');
const getService = require('./service');
const getController = require('./controller');
const getDto = require('./dto');
const getServiceSpec = require('./service.spec.js');
const getControllerSpec = require('./controller.spec.js');

const arg = process.argv?.[2];

if (!arg) {
  console.error('Please provide a name for the module');
  process.exit(1);
}

// if arg have '-' change to camelCase
const argArray = arg.split('-');
argArray.forEach((arg, index) => {
  argArray[index] = arg[0].toUpperCase() + arg.slice(1).toLowerCase();
});
const Name = argArray.join('');
const name = Name[0].toLowerCase() + Name.slice(1);

createFileWithContent(`src/schemas/${name}.schema.ts`, getSchema(Name));
createFileWithContent(`src/services/${name}/${name}.module.ts`, getModule(Name, name));
createFileWithContent(`src/services/${name}/${name}.service.ts`, getService(Name, name));
createFileWithContent(
  `src/services/${name}/${name}.controller.ts`,
  getController(Name, name, arg),
);
createFileWithContent(`src/services/${name}/dto/${name}.dto.ts`, getDto(Name));
createFileWithContent(
  `src/services/${name}/${name}.service.spec.ts`,
  getServiceSpec(Name, name),
);
createFileWithContent(
  `src/services/${name}/${name}.controller.spec.ts`,
  getControllerSpec(Name, name),
);
