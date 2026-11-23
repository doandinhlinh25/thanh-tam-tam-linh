/** Envelope cho endpoint mới, giữ code/message của các API Auth hiện hữu. */
export interface AuthFeatureResponse<T> {
  code: "success";
  data: T;
}
