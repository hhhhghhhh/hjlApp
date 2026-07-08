export function set(key,info){
    uni.setStorageSync(key, JSON.stringify(info));
}
export function get(key){
    var info=uni.getStorageSync(key)
    if(info){
        try {
            return JSON.parse(info);
        } catch (error) {
            return info
        }
    }
    return null;    
}
 export default {
    set,
    get, 
}