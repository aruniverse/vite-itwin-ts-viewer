import "./style.css";

import { FrontendIModelsAccess } from "@itwin/imodels-access-frontend";
import {
  AuthorizationClient,
  BentleyCloudRpcManager,
  IModelReadRpcInterface,
  IModelTileRpcInterface,
  QueryBinder,
  QueryRowFormat,
} from "@itwin/core-common";
import {
  CheckpointConnection,
  FitViewTool,
  IModelApp,
  ScreenViewport,
  StandardViewId,
  StandardViewTool,
  ViewCreator3d,
} from "@itwin/core-frontend";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { RealityDataAccessClient } from "@itwin/reality-data-client";

const {
  IMJS_ACCESS_TOKEN,
  IMJS_BING_MAPS_KEY,
  IMJS_CESIUM_ION_KEY,
  IMJS_ITWIN_ID,
  IMJS_IMODEL_ID,
} = import.meta.env;

const authClient: AuthorizationClient = {
  getAccessToken: async () => IMJS_ACCESS_TOKEN,
};

const rdClient = new RealityDataAccessClient({
  authorizationClient: authClient,
});

const rpcInterfaces = [
  IModelReadRpcInterface,
  IModelTileRpcInterface,
  PresentationRpcInterface,
];

BentleyCloudRpcManager.initializeClient(
  {
    uriPrefix: "https://api.bentley.com",
    info: { title: "imodel/rpc", version: "v4" },
  },
  rpcInterfaces
);

await IModelApp.startup({
  authorizationClient: authClient,
  hubAccess: new FrontendIModelsAccess(),
  rpcInterfaces,
  mapLayerOptions: {
    BingMaps: {
      key: "key",
      value: IMJS_BING_MAPS_KEY,
    },
  },
  tileAdmin: {
    cesiumIonKey: IMJS_CESIUM_ION_KEY,
  },
  realityDataAccess: rdClient,
});

await Presentation.initialize();

const iModelConnection = await CheckpointConnection.openRemote(
  IMJS_ITWIN_ID,
  IMJS_IMODEL_ID
);

iModelConnection.selectionSet.onChanged.addListener(async (ev) => {
  // console.log("Selection set changed", ev);
  if (!ev.set.elements.size) {
    return;
  }
  for (const elementId of ev.set.elements.values()) {
    for await (const row of iModelConnection.createQueryReader(
      "SELECT * FROM bis.Element WHERE ECInstanceId = ?",
      QueryBinder.from([elementId]),
      {
        rowFormat: QueryRowFormat.UseECSqlPropertyNames,
      }
    )) {
      console.log(`ECInstanceId is ${row[0]}`);
      console.log(`ECClassId is ${row.ecclassid}`);
    }
    const properties = await Presentation.presentation.getElementProperties({
      imodel: iModelConnection,
      elementId,
    });
    console.log(properties);
  }
});

const root = document.querySelector<HTMLDivElement>("#app")!;

// obtain a viewState for the model and add it to a Viewport within the container
const viewCreator = new ViewCreator3d(iModelConnection);
const viewState = await viewCreator.createDefaultView();
const vp = ScreenViewport.create(root, viewState);
IModelApp.viewManager.addViewport(vp);

IModelApp.tools.run(StandardViewTool.toolId, vp, StandardViewId.RightIso);
IModelApp.tools.run(FitViewTool.toolId, vp, true, false);

const REALITY_DATA_URL =
  "https://api.bentley.com/reality-management/reality-data";

const { realityDatas } = await rdClient.getRealityDatas(
  IMJS_ACCESS_TOKEN,
  IMJS_ITWIN_ID,
  undefined
);
console.log({ realityDatas });

for (const rd of realityDatas) {
  // const tilesetUrl = await rdClient.getRealityDataUrl(IMJS_ITWIN_ID, rd.id);
  const tilesetUrl = `${REALITY_DATA_URL}/${rd.id}?iTwinId=${IMJS_ITWIN_ID}`;
  vp.displayStyle.attachRealityModel({
    tilesetUrl,
  });
}
