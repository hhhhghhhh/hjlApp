export default {
	state: {
		list:[]
	},
	getters: {
		
	},
	mutations: {
        setList(state,data){
            state.list = data;
        },
        delDetailsByIndex(state,props){
            var {index,defailsIndex} = props;
 
            if(state.list[index]&&state.list[index].details&&state.list[index].details.length>defailsIndex){
                state.list[index].number-=state.list[index].details[defailsIndex].quantity;
                state.list[index].details.splice(defailsIndex,1)
            }
        },
        // 合并id相同的数据
        mergeById(state,data){
            console.log('data',data);
            let isExits= false
            state.list.forEach(item=>{
                if(item.id ==data.id){
                    isExits = true
                }
            })
        
            if(isExits){
                state.list.forEach(item=>{
                    if(item.id == data.id){
                        item.number += data.number;
                        item.details.push(...data.details)
                    }
                })
            }else{
                state.list.push(data)
            }
        }
	},
	actions: { 
		
	}
}