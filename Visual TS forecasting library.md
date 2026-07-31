I need to prepare a application (frontend-fastapi, backend-nextjs need) where I mainly demonstrate my special kind of forecasting method TensorAR (extracted forecasting method from [https://link.springer.com/chapter/10.1007/978-3-319-71246-8\_37](https://link.springer.com/chapter/10.1007/978-3-319-71246-8_37) this paper). But it cannot be an application itself. I need to compare it with other existing models and in this cast we selected Dlinear, TimeXer, TimeMixer, iTransformer. They have already been implemented in the @tsf_compare/models folder and my experiments are saved in the @demonstration_mid folder. Our main plan is to solve the issue of experiment, result comparison when developing a new method. For example how our TensorAR model is performing, to compare it with existing models we need to implement other existing running with proper config and collecting dataset etc but here we collect current top performing 4-5 models and standard dataset to perform the experiment.

So mainly in architecture design we plan to have 5 table user, dataset, model, experiment, result and their relation will be like

| Entity 1 | Relationship | Entity 2 | Cardinality |
| ----- | ----- | ----- | ----- |
| User | performs | Experiment | **1 : N** |
| User | owns/uploads | Dataset | **1 : N** |
| Model | used in | Experiment | **1 : N** |
| Dataset | used in | Experiment | **1 : N** |
| Experiment | has | Result | **1 : 1** |

| Entity | Attribute | Key | Description |
| ----- | ----- | ----- | ----- |
| **User** | user\_id | **PK** | Unique user identifier |
|  | name |  | User's full name |
|  | email |  | User login email |
|  | password\_hash |  | Encrypted password |
|  | created\_at |  | Account creation timestamp |
| **Model** | model\_id | **PK** | Unique model identifier |
|  | name |  | Model name (e.g., DLinear, TimesNet) |
|  | paper\_title |  | Research paper title |
|  | publication |  | Conference or journal name |
|  | year |  | Publication year |
|  | authors |  | Paper authors |
|  | description |  | Brief model description |
|  | github\_url |  | Official implementation URL |
| **Dataset** | dataset\_id | **PK** | Unique dataset identifier |
|  | owner\_id | **FK → User.user\_id** (Nullable) | Owner of the dataset (NULL for system datasets) |
|  | name |  | Dataset name |
|  | file\_path |  | Storage location of dataset file |
|  | rows |  | Number of records |
|  | columns |  | Number of features/columns |
|  | frequency |  | Sampling frequency (Hourly, Daily, etc.) |
|  | target\_column |  | Target variable for forecasting |
|  | visibility |  | Public, Private, or System |
|  | source |  | Dataset source (System/User) |
|  | uploaded\_at |  | Upload timestamp |
| **Experiment** | experiment\_id | **PK** | Unique experiment identifier |
|  | user\_id | **FK → User.user\_id** | User who performed the experiment |
|  | model\_id | **FK → Model.model\_id** | Selected forecasting model |
|  | dataset\_id | **FK → Dataset.dataset\_id** | Selected dataset |
|  | experiment\_name |  | Experiment name |
|  | train\_ratio |  | Training data ratio |
|  | validation\_ratio |  | Validation data ratio |
|  | test\_ratio |  | Test data ratio |
|  | input\_length |  | Input sequence length |
|  | prediction\_length |  | Forecast horizon |
|  | epochs |  | Number of training epochs |
|  | batch\_size |  | Training batch size |
|  | learning\_rate |  | Learning rate |
|  | status |  | Running, Completed, or Failed |
|  | created\_at |  | Experiment creation timestamp |
| **Result** | result\_id | **PK** | Unique result identifier |
|  | experiment\_id | **FK → Experiment.experiment\_id** (Unique) | Associated experiment |
|  | training\_time |  | Total model training time |
|  | MAE |  | Mean Absolute Error |
|  | RMSE |  | Root Mean Squared Error |
|  | MAPE |  | Mean Absolute Percentage Error |
|  | actual\_sequence\_path |  | File path of actual output sequence |
|  | predicted\_sequence\_path |  | File path of predicted output sequence |

Note: all attributes of the tables are roughly selected by me. You can change if need for better design.

Oh, there will be an admin panel where users can admin upload some public dataset which can be accessed by any user.

Activity flow:

Dataset upload: (only 3 dataset for now weather(live openmateo/weather, traffic, ILI)  
User upload dataset \-\> need to provide some details like: number of rows, columns and be able to select which columns to keep and might upload csv or excel only dataset. \-\> a service will run which will separate the train and test set. Here this will be as I directed for my purpose no standard needed or if it matches the standard that is good. \-\> I need length test set about 8-25 period(and it will be specific to dataset for example for example for traffic (hourly frequency) dataset the test length will be 25(day)\*24(hour per day) here for experiment testing users can select input sequence that can be 5(min)-20(max) and output sequence should be total \- input sequence so that it can be compared with ground truth. It will be easy for you to understand if you follow the @demonstration_mid folder’s notebooks. \-\> Another important portion is preparing train data. Keeping minimum 8(maximum 25 period) total length in test data left out data will be train data. If no train data is left there only models like SARIMA, ETS, TensorAR model can be tested as they directly predict from input sequence no need for training separately. On the other hand if the dataset has train and test data both any model like the previously given and  also DL models like iTransformer, TimeXer, TimeMixer etc also be used. \-\> after training (if need/ I mean for DL model only) the config, time and other data should be saved in the experiment table and result table and these two tables should be linked properly. The resulting output sequence should be saved properly and also should calculate metric like MSE, MAE, RMSE should be calculated for this. ANd shown in the front end properly with plot. And also multiple columns/features/channel can be forecasted at a time so an average result and separate result for all selected channels should be shown properly.

