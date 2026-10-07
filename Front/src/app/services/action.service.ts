import { RequestConfig } from './framework-services/http.service';
import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';

@Injectable({
  providedIn: 'root'
})
export class ActionService extends ServiceBase {
  changeStatus(id: number, isFollower: boolean,positionGuid:string) {

    var model = {
      positionGuid:positionGuid,
      id: id,
      isFollower: isFollower
    };
    const path = `${this.baseUrl}/ChangeStatus`;
    return this.httpService.post(path, model, new RequestConfig({ noValidate: true }));
  }


  constructor() {
    super("Action");
  }
  createOrEditAction(body: any) {
    const path = `${this.baseUrl}/CreateOrEdit`;
    return this.httpService.post(path, body, new RequestConfig({ noValidate: true }))
  }
}
