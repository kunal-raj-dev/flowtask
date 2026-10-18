declare const __FLOWTASK_BUILD__: string;
export const BUILD_ID = typeof __FLOWTASK_BUILD__ === 'string' ? __FLOWTASK_BUILD__ : 'development';
export const BUILD_LABEL = BUILD_ID === 'development' ? BUILD_ID : BUILD_ID.slice(0, 8);
