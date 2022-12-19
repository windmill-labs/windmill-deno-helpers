/**
 * Returns an object with no empty fields. Works with nested objects as well.
 * 
 * @param removeEmptyArraysAndObjects If `true` then arrays with no items and 
 * objects with no keys will be removed as well. Default is `true`.
 * 
 * @param createNewObject If `true` then a newly created object will be returned, 
 * otherwise the object argument will be updated in place. Default is `true`.
 */
export function removeObjectEmptyFields(object?: Record<string, any>, removeEmptyArraysAndObjects = true, createNewObject = true) {
  if(!object || typeof object !== 'object') {
    return {};
  }
  const obj = createNewObject ? {...object} : object;
  const emptyValues = [undefined, null, ''];

  for(const key in obj) {
    const value = obj[key];
    if(emptyValues.includes(value)) {
      delete obj[key];
    } else if(typeof value === 'object') {
      if(Object.keys(value).length) {
				obj[key] = removeObjectEmptyFields(value, removeEmptyArraysAndObjects, false);
      }
      if(!Object.keys(value).length && removeEmptyArraysAndObjects) {
        delete obj[key];
      }
    }
  }

  return obj;
}
